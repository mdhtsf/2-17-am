import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialNpcState } from '../src/data/npcState.js'
import { npcStateReducer } from '../src/hooks/useNpcStates.js'
import { applyNpcStateEvent } from '../src/game/npcStateTransitions.js'
import handler from '../api/chat.js'

const event = { type: 'dialogue_completed' }
const complete = (states, npcId) => npcStateReducer(states, {
  type: 'update', npcId, updater: state => applyNpcStateEvent(npcId, state, event),
})

for (const npcId of ['kai', 'mira']) {
  test(`${npcId}: first success changes encounter/familiarity only, deterministically`, () => {
    const initial = createInitialNpcState()[npcId]
    const before = structuredClone(initial)
    const next = applyNpcStateEvent(npcId, initial, event)
    assert.deepEqual(next, { ...before, hasMetPlayer: true, familiarity: 1 })
    assert.deepEqual(initial, before)
    assert.deepEqual(next, applyNpcStateEvent(npcId, initial, event))
    assert.notEqual(next, initial)
  })

  test(`${npcId}: successful turns increment 0 to 5 and then stay at 5`, () => {
    let state = createInitialNpcState()[npcId]
    for (let turn = 1; turn <= 10; turn++) {
      state = applyNpcStateEvent(npcId, state, event)
      assert.equal(state.familiarity, Math.min(turn, 5))
      assert.equal(state.hasMetPlayer, true)
    }
    assert.deepEqual(state, { ...createInitialNpcState()[npcId], hasMetPlayer: true, familiarity: 5 })
  })

  test(`${npcId}: failed, pending, panel, preset and unknown events are no-ops`, () => {
    const state = createInitialNpcState()[npcId]
    for (const type of ['dialogue_started', 'dialogue_failed', 'timeout', 'cancelled',
      'validation_error', 'panel_opened', 'panel_closed', 'npc_selected', 'cat_clicked', 'preset_selected', 'unknown']) {
      assert.equal(applyNpcStateEvent(npcId, state, { type }), state)
    }
    assert.equal(applyNpcStateEvent(npcId, state, null), state)
  })
}

test('Kai and Mira transitions stay isolated and reset still works', () => {
  let states = createInitialNpcState()
  const initialMira = states.mira
  states = complete(complete(states, 'kai'), 'kai')
  assert.equal(states.kai.familiarity, 2)
  assert.equal(states.mira, initialMira)
  const previousKai = states.kai
  states = complete(states, 'mira')
  assert.equal(states.mira.familiarity, 1)
  assert.equal(states.kai, previousKai)
  const previousMira = states.mira
  states = npcStateReducer(states, { type: 'reset', npcId: 'kai' })
  assert.deepEqual(states.kai, createInitialNpcState().kai)
  assert.equal(states.mira, previousMira)
})

test('Cat and unknown NPCs cannot acquire encounter state', () => {
  for (const npc of ['cat', 'unknown', '__proto__', null]) {
    assert.throws(() => applyNpcStateEvent(npc, createInitialNpcState().kai, event), RangeError)
  }
})

test('real API handler with mocked primary/fallback produces one completion per successful reply', async t => {
  const keys = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_FALLBACK_MODEL']
  const saved = keys.map(key => process.env[key])
  keys.forEach((key, index) => { process.env[key] = ['test-placeholder', 'test-primary', 'test-fallback'][index] })
  t.after(() => keys.forEach((key, index) => {
    if (saved[index] === undefined) delete process.env[key]
    else process.env[key] = saved[index]
  }))
  const requests = []
  let failBoth = false
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const request = JSON.parse(options.body)
    requests.push(request)
    return failBoth || request.model === 'test-primary'
      ? Response.json({ error: { message: 'mock overloaded' } }, { status: 502 })
      : Response.json({ choices: [{ message: { content: '还醒着。' } }] })
  })
  let states = createInitialNpcState()
  const histories = { kai: [], mira: [] }
  for (const npc of ['kai', 'mira']) {
    const response = await handler.fetch(new Request('http://localhost/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npc, message: '你好', history: histories[npc] }),
    }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { reply: '还醒着。' })
    states = complete(states, npc)
    assert.equal(states[npc].familiarity, 1)
  }
  assert.deepEqual(requests.map(request => request.model), ['test-primary', 'test-fallback', 'test-primary', 'test-fallback'])
  assert.deepEqual(histories, { kai: [], mira: [] })
  failBoth = true
  const before = states
  const response = await handler.fetch(new Request('http://localhost/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc: 'kai', message: '你好', history: [] }),
  }))
  if (response.ok) states = complete(states, 'kai')
  assert.equal(response.status, 502)
  assert.equal(states, before)
  assert.equal(requests.length, 6)
})
