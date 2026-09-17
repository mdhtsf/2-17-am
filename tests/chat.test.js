import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/chat.js'
import { createChatHandler } from '../server/chat-handler.js'
import { createInitialNpcState } from '../src/data/npcState.js'

async function call(body, method = 'POST', endpoint = handler.fetch) {
  // Existing API cases use a valid state unless they explicitly supply one.
  if (body && typeof body === 'object' && !Array.isArray(body) && !Object.hasOwn(body, 'npcState')) {
    body = { ...body, npcState: createInitialNpcState()[body.npc] }
  }
  const request = new Request('http://localhost/api/chat', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'GET' || method === 'HEAD' ? {} : {
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  })
  const response = await endpoint(request)
  return {
    status: response.status,
    headers: { Allow: response.headers.get('Allow') },
    data: await response.json(),
  }
}

test('injected provider receives NPCs and two complete turns are accepted', async () => {
  const endpoint = createChatHandler(async ({ npc }) => npc.id === 'kai' ? '夜班。总得有人醒着。' : '论文还没写完。')
  const first = await call({ npc: 'kai', message: '你好', history: [] }, 'POST', endpoint)
  assert.equal(first.status, 200)
  assert.equal(first.data.reply, '夜班。总得有人醒着。')
  const history = [{ role: 'user', content: '你好' }, { role: 'assistant', content: first.data.reply }]
  assert.equal((await call({ npc: 'kai', message: '然后呢', history }, 'POST', endpoint)).status, 200)
  assert.notEqual((await call({ npc: 'mira', message: '你好' }, 'POST', endpoint)).data.reply, first.data.reply)
})

test('rejects unsupported methods with Allow header', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
    const r = await call({}, method)
    assert.equal(r.status, 405)
    assert.equal(r.headers.Allow, 'POST')
  }
})

test('rejects bad JSON, empty messages, unknown NPCs, and malformed history', async () => {
  for (const body of ['{', null, [], {}, { npc: 'cat', message: 'hi' },
    { npc: '__proto__', message: 'hi' }, { npc: 'kai', message: '  ' },
    { npc: 'kai', message: 12 }, { npc: 'kai', message: 'x'.repeat(1001) },
    { npc: 'kai', message: 'hi', history: [{ role: 'system', content: 'bad' }] },
    { npc: 'kai', message: 'hi', history: 'invalid' }]) {
    const r = await call(body)
    assert.equal(r.status, 400)
    assert.equal(typeof r.data.error, 'string')
  }
})

test('parses string JSON and forwards clean request context to the provider', async () => {
  let received
  const endpoint = createChatHandler(async context => { received = context; return '收到' })
  const r = await call(JSON.stringify({ npc: 'mira', message: '  你好  ', history: [], npcState: createInitialNpcState().mira }), 'POST', endpoint)
  assert.equal(r.status, 200)
  assert.equal(received.npc.id, 'mira')
  assert.equal(received.message, '你好')
  assert.deepEqual(received.history, [])
  assert.deepEqual(received.npcState, createInitialNpcState().mira)
})

test('provider errors and invalid outputs return safe, uniform server errors', async () => {
  for (const provider of [async () => { throw new Error('private details') }, async () => null]) {
    const r = await call({ npc: 'kai', message: 'hi' }, 'POST', createChatHandler(provider))
    assert.equal(r.status, 500)
    assert.deepEqual(r.data, { error: '暂时没有听清，请稍后再试。' })
  }
})
