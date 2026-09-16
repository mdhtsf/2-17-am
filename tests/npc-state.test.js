import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialNpcState } from '../src/data/npcState.js'
import { npcStateReducer } from '../src/hooks/useNpcStates.js'
import { sendChat } from '../src/lib/chat.js'

test('Kai and Mira have the specified initial runtime state; Cat has none', () => {
  assert.deepEqual(createInitialNpcState(), {
    kai: { mood: 'neutral', familiarity: 0, trust: 0, hasMetPlayer: false },
    mira: { mood: 'exhausted', familiarity: 0, trust: 0, hasMetPlayer: false, deadlineStress: 'high' },
  })
})

for (const [id, other] of [['kai', 'mira'], ['mira', 'kai']]) {
  test(`updating ${id} leaves ${other} and previous snapshots unchanged`, () => {
    const before = createInitialNpcState()
    const after = npcStateReducer(before, { type: 'update', npcId: id, updater: state => ({ trust: state.trust + 1 }) })
    assert.equal(after[id].trust, 1)
    assert.equal(before[id].trust, 0)
    assert.equal(after[other], before[other])
    assert.equal(after[id].mood, before[id].mood)
    assert.notEqual(after, before)
  })
}

test('reset restores only the selected NPC and creates a fresh snapshot', () => {
  let states = createInitialNpcState()
  for (const id of ['kai', 'mira']) states = npcStateReducer(states, {
    type: 'update', npcId: id, updater: () => ({ trust: 2, hasMetPlayer: true }),
  })
  const reset = npcStateReducer(states, { type: 'reset', npcId: 'kai' })
  assert.deepEqual(reset.kai, createInitialNpcState().kai)
  assert.equal(reset.mira, states.mira)
  assert.equal(states.kai.trust, 2)
  assert.notEqual(reset.kai, states.kai)
})

test('sessions and NPCs do not share mutable state or defaults', () => {
  const first = createInitialNpcState()
  const second = createInitialNpcState()
  assert.notEqual(first, second)
  assert.notEqual(first.kai, first.mira)
  assert.notEqual(first.kai, second.kai)
  assert.notEqual(first.mira, second.mira)
  assert.throws(() => { first.kai.trust = 9 }, TypeError)
  assert.throws(() => { first.kai = {} }, TypeError)
  assert.throws(() => npcStateReducer(first, {
    type: 'update', npcId: 'kai', updater: state => { state.trust++; return state },
  }), TypeError)
  assert.equal(createInitialNpcState().kai.trust, 0)
})

test('unknown NPCs and invalid updater results fail without changing state', () => {
  const states = createInitialNpcState()
  for (const id of ['cat', '__proto__', 'unknown']) {
    assert.throws(() => npcStateReducer(states, { type: 'reset', npcId: id }), RangeError)
  }
  for (const patch of [null, undefined, [], 1, 'invalid']) {
    assert.throws(() => npcStateReducer(states, { type: 'update', npcId: 'kai', updater: () => patch }), TypeError)
  }
  assert.deepEqual(states, createInitialNpcState())
})

test('frontend API contract ignores runtime state and preserves per-NPC history', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/chat')
    requests.push(JSON.parse(options.body))
    return Response.json({ reply: '嗯。' })
  })
  let states = createInitialNpcState()
  const histories = { kai: [{ role: 'user', content: '我叫西瓜。' }, { role: 'assistant', content: '嗯。' }], mira: [] }
  const before = structuredClone(histories)
  states = npcStateReducer(states, { type: 'update', npcId: 'kai', updater: () => ({ trust: 1 }) })
  for (const npc of ['kai', 'mira']) await sendChat({ npc, message: '你好', history: histories[npc], npcState: states[npc], npcStates: states })
  assert.deepEqual(requests, ['kai', 'mira'].map(npc => ({ npc, message: '你好', history: before[npc] })))
  assert.deepEqual(histories, before)
})
