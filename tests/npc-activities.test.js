import test from 'node:test'
import assert from 'node:assert/strict'
import { ambientNpcIds, npcActivities, createInitialNpcActivities } from '../src/data/npcActivities.js'
import { nextNpcActivity } from '../src/game/npcActivityTransitions.js'
import { npcActivityReducer } from '../src/hooks/useNpcActivities.js'
import { createInitialNpcState } from '../src/data/npcState.js'
import { sendChat } from '../src/lib/chat.js'

test('initial activities are valid, session-local and immutable', () => {
  const initial = createInitialNpcActivities()
  assert.deepEqual(initial, { kai: 'behind_counter', mira: 'reading_notes', cat: 'sleeping' })
  assert.notEqual(initial, createInitialNpcActivities())
  assert.throws(() => { initial.kai = 'sleeping' }, TypeError)
  assert.throws(() => { npcActivities.kai.push('sleeping') }, TypeError)
})

for (const npcId of ambientNpcIds) {
  test(`${npcId} follows a deterministic complete cycle without affecting other NPCs`, () => {
    const initial = createInitialNpcActivities()
    let state = initial
    for (let index = 0; index < npcActivities[npcId].length; index++) {
      const previous = state
      const next = nextNpcActivity(npcId, state[npcId])
      assert.equal(next, npcActivities[npcId][(index + 1) % 4])
      assert.equal(nextNpcActivity(npcId, state[npcId]), next)
      state = npcActivityReducer(state, { type: 'advance', npcId })
      assert.equal(state[npcId], next)
      assert.equal(previous[npcId], npcActivities[npcId][index])
      for (const other of ambientNpcIds.filter(id => id !== npcId)) assert.equal(state[other], initial[other])
      assert.ok(Object.isFrozen(state))
    }
    assert.deepEqual(state, initial)
  })

  test(`${npcId} can be explicitly set then advanced; reset restores all activities`, () => {
    const initial = createInitialNpcActivities()
    let state = npcActivityReducer(initial, { type: 'set', npcId, activity: npcActivities[npcId][2] })
    assert.equal(state[npcId], npcActivities[npcId][2])
    assert.equal(npcActivityReducer(state, { type: 'set', npcId, activity: state[npcId] }), state)
    state = npcActivityReducer(state, { type: 'advance', npcId })
    assert.equal(state[npcId], npcActivities[npcId][3])
    const reset = npcActivityReducer(state, { type: 'reset' })
    assert.deepEqual(reset, initial)
    assert.notEqual(reset, initial)
    assert.equal(state[npcId], npcActivities[npcId][3])
  })
}

test('unknown NPCs, mismatched activities and invalid actions are rejected', () => {
  const initial = createInitialNpcActivities()
  for (const npcId of ['unknown', '__proto__', 'constructor', null, undefined]) {
    assert.throws(() => nextNpcActivity(npcId, 'sleeping'), RangeError)
    assert.throws(() => npcActivityReducer(initial, { type: 'advance', npcId }), RangeError)
    assert.throws(() => npcActivityReducer(initial, { type: 'set', npcId, activity: 'sleeping' }), RangeError)
  }
  for (const npcId of ambientNpcIds) {
    for (const activity of [null, undefined, 0, {}, [], 'invalid', ...npcActivities[ambientNpcIds.find(id => id !== npcId)]]) {
      assert.throws(() => nextNpcActivity(npcId, activity), RangeError)
      assert.throws(() => npcActivityReducer(initial, { type: 'set', npcId, activity }), RangeError)
    }
  }
  assert.throws(() => npcActivityReducer(initial, { type: 'teleport', npcId: 'kai' }), TypeError)
  assert.deepEqual(initial, createInitialNpcActivities())
})

test('ambient state never enters chat payload or relationship state', async t => {
  const states = createInitialNpcState()
  const before = structuredClone(states)
  const activities = npcActivityReducer(createInitialNpcActivities(), { type: 'advance', npcId: 'kai' })
  const requests = []
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    requests.push(JSON.parse(options.body))
    return Response.json({ reply: '嗯。' })
  })
  for (const npc of ['kai', 'mira']) {
    await sendChat({ npc, message: '你好', history: [], npcState: states[npc], activities, currentActivity: activities[npc] })
  }
  assert.deepEqual(requests, ['kai', 'mira'].map(npc => ({ npc, message: '你好', history: [], npcState: states[npc] })))
  assert.deepEqual(states, before)
})
