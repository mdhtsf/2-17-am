import test from 'node:test'
import assert from 'node:assert/strict'
import { createSocialHandler } from '../server/social-handler.js'
import { generateSocialDialogue } from '../server/social-dialogue.js'
import { requestSocialModel, safeSocialDetail } from '../server/social-transport.js'
const context = {kaiActivity:'behind_counter',miraActivity:'talking_to_kai',miraPreviousActivity:'reading_notes'}
const request=()=>new Request('http://localhost/api/social-chat',{method:'POST',body:JSON.stringify(context)})
const good={lines:[{speaker:'kai',text:'夜还长。'},{speaker:'mira',text:'嗯。'}]}
async function fixture(fn) {
 const fetch=globalThis.fetch
 const keys=['OPENROUTER_API_KEY','OPENROUTER_MODEL','SOCIAL_CHAT_DEBUG','NODE_ENV','VERCEL_ENV']
 const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
 Object.assign(process.env,{OPENROUTER_API_KEY:'sk-test-secret',OPENROUTER_MODEL:'test-model',SOCIAL_CHAT_DEBUG:'1',NODE_ENV:'development',VERCEL_ENV:'development'})
 try {await fn()} finally {globalThis.fetch=fetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k]}}
}
test('social diagnostics distinguish HTTP errors, HTTP-200 provider errors, envelopes and content',()=>fixture(async()=>{
 const cases=[
  [()=>Response.json({error:{code:401,message:'Invalid key sk-test-secret'}},{status:401}),'openrouter_http_error','HTTP 401'],
  [()=>Response.json({error:{code:503,message:'Upstream error from Nvidia: Service temporarily overloaded'}}),'openrouter_provider_error','provider 503'],
  [()=>new Response('bad envelope'),'response_json_error','envelope'],
  [()=>Response.json({choices:[]}),'invalid_response','message.content'],
  [()=>Response.json({choices:[{finish_reason:'length',message:{content:'{'}}]}),'truncated_response','token budget'],
  [()=>Response.json({choices:[{message:{content:JSON.stringify(good)+'!'}}]}),'json_parse_error','position'],
  [()=>Response.json({choices:[{message:{content:'{"lines":[{"speaker":"cat","text":"喵"},{"speaker":"mira","text":"嗯"}]}'}}]}),'schema_validation_error','speaker'],
 ]
 for(const [reply,reason,detail] of cases){
  globalThis.fetch=async()=>reply()
  const body=await(await createSocialHandler()(request())).json()
  assert.equal(body.source,'fallback');assert.equal(body.reason,reason);assert.match(body.detail,new RegExp(detail))
  assert.equal(body.diagnostics[0].event,'request_started');assert.doesNotMatch(JSON.stringify(body),/sk-test-secret/)
 }
}))
test('social JSON mode preserves headers/extraction; fenced JSON is accepted but prose is not repaired',()=>fixture(async()=>{
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(options.headers.Authorization,'Bearer sk-test-secret')
  assert.equal(options.headers['Content-Type'],'application/json')
  assert.deepEqual(JSON.parse(options.body).response_format,{type:'json_object'})
  return Response.json({choices:[{finish_reason:'stop',message:{content:'```json\n'+JSON.stringify(good)+'\n```',reasoning:'secret reasoning'}}]})
 }
 const result=await(await createSocialHandler()(request())).json()
 assert.equal(result.source,'llm');assert.deepEqual(result.lines,good.lines)
 assert.doesNotMatch(JSON.stringify(result),/secret reasoning/)
 assert.ok(result.diagnostics.some(d=>d.event==='schema_validated'))
}))
test('configuration, network and cancellation report distinct causes; production strips diagnostics',()=>fixture(async()=>{
 delete process.env.OPENROUTER_API_KEY
 assert.equal((await(await createSocialHandler()(request())).json()).reason,'missing_api_key')
 process.env.OPENROUTER_API_KEY='sk-test-secret'
 globalThis.fetch=async()=>{throw new TypeError('fetch failed',{cause:{code:'ENOTFOUND'}})}
 assert.equal((await(await createSocialHandler()(request())).json()).reason,'network_error')
 const controller=new AbortController();controller.abort()
 await assert.rejects(()=>requestSocialModel({},controller.signal),e=>e.reason==='request_cancelled')
 process.env.NODE_ENV='production'
 globalThis.fetch=async()=>Response.json({error:{code:503,message:'secret upstream detail'}})
 const body=await(await createSocialHandler()(request())).json()
 assert.deepEqual(body,{source:'fallback',fallback:true,reason:'openrouter_provider_error'})
 assert.equal(safeSocialDetail('Bearer abc sk-test-secret'),'[redacted] [redacted]')
}))
test('timeout diagnostics identify the full server request budget',()=>fixture(async()=>{
 const original=AbortSignal.timeout
 AbortSignal.timeout=()=>AbortSignal.abort(new DOMException('Expired','TimeoutError'))
 globalThis.fetch=async(_url,{signal})=>{throw signal.reason}
 try{await assert.rejects(()=>generateSocialDialogue(context),e=>e.reason==='timeout'&&e.message.includes('45 seconds'))}
 finally{AbortSignal.timeout=original}
}))
