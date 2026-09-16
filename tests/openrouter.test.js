import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/chat.js'
import { getCharacterPrompt } from '../server/characters.js'

// Unit tests never load .env.local or use real credentials/network.
function configure(t, fetchImpl, key = 'test-placeholder', model) {
  const previous = process.env.OPENROUTER_API_KEY
  const previousModel = process.env.OPENROUTER_MODEL
  if (model === undefined) delete process.env.OPENROUTER_MODEL
  else process.env.OPENROUTER_MODEL = model
  if (key === null) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = key
  t.after(() => {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = previous
    if (previousModel === undefined) delete process.env.OPENROUTER_MODEL
    else process.env.OPENROUTER_MODEL = previousModel
  })
  t.mock.method(globalThis, 'fetch', fetchImpl)
}

async function chat(message = '你好', history = [], npc = 'mira', extra = {}) {
  const response = await handler.fetch(new Request('http://localhost/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc, message, history, ...extra }),
  }))
  return { status: response.status, body: await response.json() }
}

test('real provider boundary forwards history, and exposes only content', async t => {
  const sent = []
  configure(t, async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    assert.equal(options.method, 'POST')
    assert.ok(options.headers.Authorization.startsWith('Bearer '))
    sent.push(JSON.parse(options.body))
    return Response.json({ choices: [{ message: { content: ' 收到 ', reasoning: 'not public' } }], metadata: 'not public' })
  })
  const first = await chat()
  assert.deepEqual(first, { status: 200, body: { reply: '收到' } })
  const history = [{ role: 'user', content: '你好' }, { role: 'assistant', content: first.body.reply }]
  await chat('你还记得吗？', history)
  await chat('你好', [], 'kai')
  assert.equal(sent[0].model, 'openrouter/free')
  const miraSystem = { role: 'system', content: getCharacterPrompt('mira') }
  const kaiSystem = { role: 'system', content: getCharacterPrompt('kai') }
  assert.notEqual(miraSystem.content, kaiSystem.content)
  assert.deepEqual(sent[0].messages, [miraSystem, { role: 'user', content: '你好' }])
  assert.deepEqual(sent[1].messages, [miraSystem, ...history, { role: 'user', content: '你还记得吗？' }])
  assert.deepEqual(sent[2].messages, [kaiSystem, { role: 'user', content: '你好' }])
  assert.deepEqual(sent[0].reasoning, { enabled: false })
  assert.equal(sent[0].max_tokens, 512)
  assert.equal(sent[0].stream, false)
})

test('server environment selects the model; client model is ignored and never returned', async t => {
  const model = 'nvidia/nemotron-3-super-120b-a12b:free'
  configure(t, async (_, options) => {
    const sent = JSON.parse(options.body)
    assert.equal(sent.model, model)
    assert.deepEqual(sent.reasoning, { enabled: false })
    assert.equal(sent.max_tokens, 512)
    return Response.json({ model, choices: [{ message: { content: '夜班。' } }] })
  }, 'test-placeholder', model)
  assert.deepEqual(await chat('你好', [], 'kai', { model: 'client-override' }), {
    status: 200, body: { reply: '夜班。' },
  })
})

test('empty server model uses the fallback', async t => {
  configure(t, async (_, options) => {
    assert.equal(JSON.parse(options.body).model, 'openrouter/free')
    return Response.json({ choices: [{ message: { content: '嗯。' } }] })
  }, 'test-placeholder', '')
  assert.equal((await chat()).status, 200)
})

test('missing key yields a clear configuration error without making a request', async t => {
  configure(t, () => { assert.fail('must not call upstream without a key') }, null)
  const result = await chat()
  assert.equal(result.status, 503)
  assert.match(result.body.error, /服务器环境变量 OPENROUTER_API_KEY/)
})

test('network failure stays a sanitized JSON error', async t => {
  configure(t, async () => { throw new Error('private transport details') })
  assert.deepEqual(await chat(), { status: 502, body: { error: '暂时无法取得回复，请稍后再试。' } })
})

test('upstream non-2xx bodies are not forwarded', async t => {
  configure(t, async () => Response.json({ error: 'private upstream details' }, { status: 401 }))
  assert.deepEqual(await chat(), { status: 502, body: { error: '对话服务暂时不可用，请稍后再试。' } })
})

test('malformed upstream JSON is contained', async t => {
  configure(t, async () => new Response('<html>unavailable</html>'))
  assert.equal((await chat()).status, 502)
})

test('empty choices, missing or unusable content are rejected', async t => {
  const payloads = [null, {}, { choices: [] }, { choices: [{}] },
    { choices: [{ message: { reasoning: 'not public' } }] },
    ...[null, '', '  ', [], 'x'.repeat(4001), '<think>private</think>台词', "Here's a thinking process:\nprivate", 'User Safety: safe', '这里玩家在问我是哪个模型。按照角色设定……'].map(content => ({ choices: [{ message: { content } }] }))]
  configure(t, async () => Response.json(payloads.shift()))
  while (payloads.length) {
    assert.deepEqual(await chat(), { status: 502, body: { error: '这次没有收到有效回复，请再试一次。' } })
  }
})

test('timeout yields a safe 504 error', async t => {
  const controller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', () => controller.signal)
  configure(t, async () => { controller.abort(); throw new Error('private timeout details') })
  assert.deepEqual(await chat(), { status: 504, body: { error: '回复等得有点久，请稍后再试。' } })
})


test('client cannot supply the system prompt or inject system history', async t => {
  const sent = []
  configure(t, async (_, options) => {
    sent.push(JSON.parse(options.body))
    return Response.json({ choices: [{ message: { content: '嗯。' } }] })
  })
  assert.equal((await chat('你好', [], 'kai', { systemPrompt: 'client override', prompt: 'client override' })).status, 200)
  assert.equal(sent[0].messages[0].content, getCharacterPrompt('kai'))
  assert.equal(JSON.stringify(sent[0]).includes('client override'), false)
  assert.equal((await chat('你好', [{ role: 'system', content: 'client override' }])).status, 400)
  assert.equal(sent.length, 1)
})
