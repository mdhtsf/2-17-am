import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/chat.js'
import { getCharacterPrompt } from '../server/characters.js'

// Unit tests never load .env.local or use real credentials/network.
function configure(t, fetchImpl, key = 'test-placeholder', model, fallbackModel) {
  const previous = process.env.OPENROUTER_API_KEY
  const previousModel = process.env.OPENROUTER_MODEL
  const previousFallback = process.env.OPENROUTER_FALLBACK_MODEL
  if (fallbackModel === undefined) delete process.env.OPENROUTER_FALLBACK_MODEL
  else process.env.OPENROUTER_FALLBACK_MODEL = fallbackModel
  if (model === undefined) delete process.env.OPENROUTER_MODEL
  else process.env.OPENROUTER_MODEL = model
  if (key === null) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = key
  t.after(() => {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = previous
    if (previousModel === undefined) delete process.env.OPENROUTER_MODEL
    else process.env.OPENROUTER_MODEL = previousModel
    if (previousFallback === undefined) delete process.env.OPENROUTER_FALLBACK_MODEL
    else process.env.OPENROUTER_FALLBACK_MODEL = previousFallback
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
  }, 'test-placeholder', model, 'test-fallback')
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
  configure(t, () => { assert.fail('must not call upstream without a key') }, null, 'test-primary', 'test-fallback')
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

const primaryModel = 'nvidia/nemotron-3-super-120b-a12b:free'
const fallbackModel = 'nvidia/nemotron-3.5-lightning:free'
const safeUpstreamError = { status: 502, body: { error: '对话服务暂时不可用，请稍后再试。' } }
const success = () => Response.json({ choices: [{ message: { content: '还醒着。', reasoning: 'private' } }], model: fallbackModel })

test('primary success makes exactly one request even when fallback is configured', async t => {
  const sent = []
  configure(t, async (_, options) => { sent.push(JSON.parse(options.body)); return success() },
    'test-placeholder', primaryModel, fallbackModel)
  assert.deepEqual(await chat(), { status: 200, body: { reply: '还醒着。' } })
  assert.deepEqual(sent.map(request => request.model), [primaryModel])
})

for (const status of [502, 503, 504]) {
  for (const npc of ['kai', 'mira']) {
    test(`${npc}: primary ${status} switches once with identical context and generation settings`, async t => {
      const sent = []
      const signals = []
      configure(t, async (_, options) => {
        sent.push(JSON.parse(options.body))
        signals.push(options.signal)
        return sent.length === 1
          ? Response.json({ error: { message: 'private provider unavailable' } }, { status }) : success()
      }, 'test-placeholder', primaryModel, fallbackModel)
      const history = [{ role: 'user', content: '我叫西瓜。' }, { role: 'assistant', content: '记住了。' }]
      const result = await chat('我叫什么？', history, npc, { model: 'client-primary', fallbackModel: 'client-fallback' })
      assert.deepEqual(result, { status: 200, body: { reply: '还醒着。' } })
      assert.deepEqual(sent.map(request => request.model), [primaryModel, fallbackModel])
      const { model: firstModel, ...first } = sent[0]
      const { model: secondModel, ...second } = sent[1]
      assert.deepEqual(second, first)
      assert.deepEqual(second.messages, [
        { role: 'system', content: getCharacterPrompt(npc) }, ...history,
        { role: 'user', content: '我叫什么？' },
      ])
      assert.deepEqual(second.reasoning, { enabled: false })
      assert.equal(second.max_tokens, 512)
      assert.equal(second.stream, false)
      assert.equal(signals[0], signals[1])
    })
  }
}

for (const metadata of [
  { limit_source: 'upstream_provider_shared_pool' },
  { limit_source: 'provider_overloaded' },
  { limit_source: 'provider_temporary_rate_limit' },
  { error_type: 'provider_overloaded' },
  { error_type: 'provider_temporary_rate_limit' },
]) {
  test(`provider 429 falls back for ${JSON.stringify(metadata)}`, async t => {
    const models = []
    configure(t, async (_, options) => {
      models.push(JSON.parse(options.body).model)
      return models.length === 1 ? Response.json({ error: { metadata } }, { status: 429 }) : success()
    }, 'test-placeholder', primaryModel, fallbackModel)
    assert.equal((await chat()).status, 200)
    assert.deepEqual(models, [primaryModel, fallbackModel])
  })
}

for (const metadata of [
  { limit_source: 'openrouter_free_tier_daily' },
  { limit_source: 'account_level' },
  { limit_source: 'api_quota_exhausted' },
  { limit_source: 'account_quota_exhausted', error_type: 'provider_overloaded' },
  { limit_source: 'unknown', provider_name: 'NVIDIA' },
  { provider_name: 'NVIDIA', error_type: 'rate_limit_exceeded' },
  { limit_source: 'upstream_provider_shared_pool', is_byok: true },
  undefined,
]) {
  test(`account or ambiguous 429 does not fall back: ${JSON.stringify(metadata)}`, async t => {
    let calls = 0
    configure(t, async () => {
      calls++
      return Response.json({ error: { message: 'private quota details', metadata } }, { status: 429 })
    }, 'test-placeholder', primaryModel, fallbackModel)
    assert.deepEqual(await chat(), safeUpstreamError)
    assert.equal(calls, 1)
  })
}

for (const status of [400, 401, 402, 403, 404, 500]) {
  test(`HTTP ${status} without explicit transient classification does not fall back`, async t => {
    let calls = 0
    configure(t, async () => {
      calls++
      return Response.json({ error: { message: 'private details' } }, { status })
    }, 'test-placeholder', primaryModel, fallbackModel)
    assert.deepEqual(await chat(), safeUpstreamError)
    assert.equal(calls, 1)
  })
}

test('both models failing returns only the safe error and makes no third request', async t => {
  const models = []
  configure(t, async (_, options) => {
    models.push(JSON.parse(options.body).model)
    return Response.json({ error: { message: 'private details', metadata: { provider_name: 'secret' } } }, { status: 502 })
  }, 'test-placeholder', primaryModel, fallbackModel)
  assert.deepEqual(await chat(), safeUpstreamError)
  assert.deepEqual(models, [primaryModel, fallbackModel])
})

test('recognized fetch network failure immediately falls back', async t => {
  const models = []
  configure(t, async (_, options) => {
    models.push(JSON.parse(options.body).model)
    if (models.length === 1) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })
    return success()
  }, 'test-placeholder', primaryModel, fallbackModel)
  assert.equal((await chat()).status, 200)
  assert.deepEqual(models, [primaryModel, fallbackModel])
})

for (const fallback of [undefined, '', primaryModel]) {
  test(`missing/empty/identical fallback never retries primary: ${String(fallback)}`, async t => {
    let calls = 0
    configure(t, async () => { calls++; return new Response('Bad gateway', { status: 502 }) },
      'test-placeholder', primaryModel, fallback)
    assert.deepEqual(await chat(), safeUpstreamError)
    assert.equal(calls, 1)
  })
}

test('exhausted overall timeout does not start a second request', async t => {
  const controller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 45000)
    return controller.signal
  })
  let calls = 0
  configure(t, async () => { calls++; controller.abort(); throw new TypeError('fetch failed') },
    'test-placeholder', primaryModel, fallbackModel)
  assert.deepEqual(await chat(), { status: 504, body: { error: '回复等得有点久，请稍后再试。' } })
  assert.equal(calls, 1)
})

test('local validation and unknown programming failures never trigger fallback', async t => {
  let calls = 0
  configure(t, async () => { calls++; throw new TypeError('Invalid request configuration') },
    'test-placeholder', primaryModel, fallbackModel)
  assert.equal((await chat('你好', [], 'unknown')).status, 400)
  assert.equal((await chat('  ')).status, 400)
  assert.equal(calls, 0)
  assert.equal((await chat()).status, 502)
  assert.equal(calls, 1)
})

test('unusable reply or invalid JSON is not a reason to switch models', async t => {
  const responses = [new Response('invalid json'), Response.json({ choices: [] }),
    Response.json({ choices: [{ message: { content: 'User Safety: safe' } }] })]
  let calls = 0
  configure(t, async () => { calls++; return responses.shift() },
    'test-placeholder', primaryModel, fallbackModel)
  for (let index = 0; index < 3; index++) {
    assert.equal((await chat()).status, 502)
    assert.equal(calls, index + 1)
  }
})

test('non-JSON gateway errors and HTTP 200 embedded provider failures can fall back', async t => {
  const responses = [new Response('Bad gateway', { status: 502 }), success(),
    Response.json({ error: { code: 503, message: 'private unavailable' } }), success()]
  let calls = 0
  configure(t, async () => { calls++; return responses.shift() },
    'test-placeholder', primaryModel, fallbackModel)
  assert.equal((await chat()).status, 200)
  assert.equal(calls, 2)
  assert.equal((await chat()).status, 200)
  assert.equal(calls, 4)
})

for (const code of ['ERR_INVALID_URL', 'CERT_HAS_EXPIRED']) {
  test(`fetch configuration failure ${code} does not fall back`, async t => {
    let calls = 0
    configure(t, async () => { calls++; throw new TypeError('fetch failed', { cause: { code } }) },
      'test-placeholder', primaryModel, fallbackModel)
    assert.equal((await chat()).status, 502)
    assert.equal(calls, 1)
  })
}

for (const status of [500, 529]) {
  test(`explicit provider overload on HTTP ${status} can fall back`, async t => {
    let calls = 0
    configure(t, async () => {
      calls++
      return calls === 1 ? Response.json({ error: { metadata: { error_type: 'provider_overloaded' } } }, { status }) : success()
    }, 'test-placeholder', primaryModel, fallbackModel)
    assert.equal((await chat()).status, 200)
    assert.equal(calls, 2)
  })
}

test('malformed 429 error body does not imply a provider rate limit', async t => {
  let calls = 0
  configure(t, async () => { calls++; return new Response('private invalid JSON', { status: 429 }) },
    'test-placeholder', primaryModel, fallbackModel)
  assert.deepEqual(await chat(), safeUpstreamError)
  assert.equal(calls, 1)
})
