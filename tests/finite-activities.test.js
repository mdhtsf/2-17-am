import test from 'node:test'
import assert from 'node:assert/strict'
import { createFiniteActivities } from '../src/game/finiteActivities.js'
import { finiteActivityDurations } from '../shared/npcActivities.js'

function fixture(random = () => 0) {
  const timers = new Map(), completed = [], resets = []
  let serial = 0
  const clock = createFiniteActivities({ random, onComplete: (...args) => completed.push(args), onReset: id => resets.push(id),
    setTimer: (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }, clearTimer: id => timers.delete(id) })
  clock.start()
  return { clock, timers, completed, resets }
}
const arrival = { phase: 'idle', destination: 'coffee_station' }
test('only coffee and shelf are finite and their randomized times remain in bounds', () => {
  assert.deepEqual(Object.keys(finiteActivityDurations.kai), ['making_coffee', 'checking_shelf'])
  for (const entropy of [0, .17, .5, .999999]) for (const [activity, destination] of [['making_coffee', 'coffee_station'], ['checking_shelf', 'shelf']]) {
    const { clock, timers } = fixture(() => entropy)
    clock.report('kai', activity, { phase: 'idle', destination })
    const ms = [...timers.values()][0].ms
    assert.ok(ms >= 5000 && ms <= 10000)
    assert.equal(ms, 5000 + Math.floor(entropy * 5001))
  }
})
test('countdown starts only after arrival and settle, not assignment or intermediate idle', () => {
  const { clock, timers } = fixture()
  for (const movement of [{ phase: 'walking', destination: 'coffee_station' }, { phase: 'settling', destination: 'coffee_station' }, { phase: 'idle', destination: 'counter' }]) {
    clock.report('kai', 'making_coffee', movement)
    assert.equal(timers.size, 0)
  }
  clock.report('kai', 'making_coffee', arrival)
  clock.report('kai', 'making_coffee', arrival)
  assert.equal(timers.size, 1)
})
test('completion emits once without selecting another activity, repeated idle cannot restart it', () => {
  const { clock, timers, completed } = fixture()
  clock.report('kai', 'making_coffee', arrival)
  const { fn } = [...timers.values()][0]
  fn(); fn()
  clock.report('kai', 'making_coffee', arrival)
  assert.deepEqual(completed, [['kai', 'making_coffee']])
})
test('obsolete callbacks cannot complete a new activity, including A to B to A', () => {
  const { clock, timers, completed } = fixture()
  clock.report('kai', 'making_coffee', arrival)
  const stale = [...timers.values()][0].fn
  clock.report('kai', 'checking_shelf', { phase: 'walking', destination: 'shelf' })
  assert.equal(timers.size, 0)
  clock.report('kai', 'making_coffee', arrival)
  stale()
  assert.equal(completed.length, 0)
  assert.equal(timers.size, 1)
  ;[...timers.values()][0].fn()
  assert.deepEqual(completed, [['kai', 'making_coffee']])
})
test('stop cleans timers and stale callbacks, restart creates only one countdown', () => {
  const { clock, timers, completed } = fixture()
  clock.report('kai', 'making_coffee', arrival)
  const stale = [...timers.values()][0].fn
  clock.stop(); stale()
  assert.equal(timers.size, 0)
  clock.start(); clock.start(); stale()
  assert.equal(timers.size, 1)
  assert.equal(completed.length, 0)
})
test('travel resuming invalidates the prior arrival timer', () => {
  const { clock, timers, completed } = fixture()
  clock.report('kai', 'making_coffee', arrival)
  const stale = [...timers.values()][0].fn
  clock.report('kai', 'making_coffee', { ...arrival, phase: 'walking' })
  clock.report('kai', 'making_coffee', arrival)
  stale()
  assert.equal(completed.length, 0)
  assert.equal(timers.size, 1)
})
test('window watching, studying and Cat resting never time out', () => {
  const { clock, timers } = fixture()
  for (const [id, activity, destination] of [['kai', 'looking_out_window', 'window'], ['mira', 'reading_notes', 'notes_spot'], ['cat', 'sleeping', 'floor']]) clock.report(id, activity, { phase: 'idle', destination })
  assert.equal(timers.size, 0)
})

test('an idle report at the wrong destination invalidates the countdown', () => {
  const { clock, timers, completed } = fixture()
  clock.report('kai', 'making_coffee', arrival)
  const stale = [...timers.values()][0].fn
  clock.report('kai', 'making_coffee', { phase: 'idle', destination: 'counter' })
  stale()
  assert.equal(timers.size, 0)
  assert.equal(completed.length, 0)
})
