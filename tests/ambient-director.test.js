import test from 'node:test'
import assert from 'node:assert/strict'
import { AMBIENT_DIRECTOR, ambientDelay, activityChoices, chooseAmbientEvent, createAmbientDirector } from '../src/game/ambientDirector.js'
import { createInitialNpcActivities, ambientNpcIds } from '../src/data/npcActivities.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'

function seededRandom() {
  let value = 743
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296)
}

test('first and later randomized delays stay in range and vary', () => {
  const random = seededRandom()
  for (const first of [true, false]) {
    const [min, max] = first ? AMBIENT_DIRECTOR.firstDelayMs : AMBIENT_DIRECTOR.nextDelayMs
    assert.equal(ambientDelay(first, () => 0), min)
    assert.equal(ambientDelay(first, () => 1 - Number.EPSILON), max)
    const values = Array.from({ length: 1000 }, () => ambientDelay(first, random))
    assert.ok(values.every(value => Number.isInteger(value) && value >= min && value <= max))
    assert.ok(new Set(values).size > 500)
  }
})

test('NPC selection avoids consecutive repeats and balances a long session', () => {
  const random = seededRandom()
  const activities = { ...createInitialNpcActivities() }
  const counts = { kai: 0, mira: 0, cat: 0 }
  let recent = []
  for (let index = 0; index < 6000; index++) {
    const event = chooseAmbientEvent(activities, recent, random)
    assert.notEqual(event.npcId, recent.at(-1))
    assert.notEqual(event.activity, activities[event.npcId])
    assert.equal(event.destination, getNpcSceneLocation(event.npcId, event.activity))
    activities[event.npcId] = event.activity
    counts[event.npcId]++
    recent = [...recent, event.npcId].slice(-2)
  }
  assert.ok(Object.values(counts).every(count => count > 1800 && count < 2200))
  // Same draw favors the rested Cat over recently selected Kai.
  assert.equal(chooseAmbientEvent(activities, ['kai', 'mira'], () => 0.3).npcId, 'cat')
  assert.equal(chooseAmbientEvent(activities, ['mira'], () => 0.3).npcId, 'kai')
})

test('activity weights prefer short/medium actual routes but keep distant destinations reachable', () => {
  const choices = activityChoices('kai', 'behind_counter')
  const coffee = choices.find(choice => choice.activity === 'making_coffee')
  const shelf = choices.find(choice => choice.activity === 'checking_shelf')
  const window = choices.find(choice => choice.activity === 'looking_out_window')
  assert.ok(coffee.distance < shelf.distance && shelf.distance < window.distance)
  assert.ok(coffee.weight > window.weight && shelf.weight > window.weight)
  assert.ok(window.weight > 0)
  const random = seededRandom()
  let short = 0
  for (let i = 0; i < 2000; i++) {
    const event = chooseAmbientEvent(createInitialNpcActivities(), ['mira', 'cat'], random)
    if (event.distance <= AMBIENT_DIRECTOR.mediumDistance) short++
  }
  assert.ok(short > 1700)
  assert.equal(activityChoices('mira', 'reading_notes').find(c => c.activity === 'checking_phone').distance, 0)
  assert.equal(activityChoices('cat', 'grooming').find(c => c.activity === 'sleeping').distance, 0)
})

function fixture() {
  const timers = new Map()
  const events = []
  let serial = 0
  let activities = createInitialNpcActivities()
  const director = createAmbientDirector({
    getActivities: () => activities, random: () => 0,
    onActivity: (npcId, activity) => { activities = { ...activities, [npcId]: activity }; events.push({ npcId, activity }) },
    setTimer: (callback, delay) => { timers.set(++serial, { callback, delay }); return serial },
    clearTimer: id => timers.delete(id),
  })
  const report = (id, phase, destination = getNpcSceneLocation(id, activities[id])) => director.reportMovement(id, { phase, destination })
  const fire = () => { assert.equal(timers.size, 1); const [id, timer] = [...timers][0]; timers.delete(id); timer.callback() }
  return { director, timers, events, report, fire }
}

test('one reservation blocks further events through dispatch, walking and settling; idle resumes', () => {
  const f = fixture()
  f.director.start()
  assert.equal(f.timers.size, 0, 'wait for all scene entities to mount')
  for (const id of ambientNpcIds) f.report(id, 'idle')
  assert.equal([...f.timers.values()][0].delay, 8000)
  f.fire()
  assert.deepEqual(f.events, [{ npcId: 'kai', activity: 'making_coffee' }])
  assert.equal(f.timers.size, 0, 'reservation exists before any movement report')
  f.report('kai', 'idle', 'counter') // stale initial render
  f.report('mira', 'idle')
  assert.equal(f.timers.size, 0)
  for (const phase of ['walking', 'walking', 'settling']) {
    f.report('kai', phase)
    assert.equal(f.timers.size, 0)
  }
  f.report('kai', 'idle')
  assert.equal([...f.timers.values()][0].delay, 16000)
  f.report('kai', 'idle')
  assert.equal(f.timers.size, 1, 'duplicate reports cannot accumulate timers')
  f.fire()
  assert.deepEqual(f.events.at(-1), { npcId: 'mira', activity: 'checking_phone' })
  f.report('mira', 'idle') // same-location pose, no walking required
  assert.equal(f.timers.size, 1)
  f.director.stop()
  assert.equal(f.timers.size, 0)
})

test('any ongoing movement pauses scheduling; cleanup and Strict Mode restart keep one timer', () => {
  const f = fixture()
  for (const id of ambientNpcIds) f.report(id, 'idle')
  f.director.start()
  f.director.start()
  assert.equal(f.timers.size, 1)
  f.report('cat', 'walking')
  assert.equal(f.timers.size, 0)
  f.report('cat', 'settling')
  assert.equal(f.timers.size, 0)
  f.report('cat', 'idle')
  assert.equal(f.timers.size, 1)
  const stale = [...f.timers.values()][0].callback
  f.director.stop()
  stale()
  assert.equal(f.events.length, 0)
  f.director.start()
  assert.equal(f.timers.size, 1)
  f.director.stop()
})

test('interaction locks exclude only interacting NPCs without changing existing deadlines', () => {
  const f = fixture()
  for (const id of ambientNpcIds) f.report(id, 'idle')
  f.director.start()
  const timer = [...f.timers.keys()][0]
  f.director.setInteractionLocks(['kai'])
  assert.equal([...f.timers.keys()][0], timer)
  f.fire()
  assert.equal(f.events[0].npcId, 'mira')
  f.report('mira', 'idle')
  f.director.setInteractionLocks([])
  f.fire()
  assert.equal(f.events[1].npcId, 'kai', 'closing interaction restores eligibility')
  f.director.stop()
})

test('all locked pauses safely and unlocking resumes; only eligible NPC may repeat', () => {
  const f = fixture()
  for (const id of ambientNpcIds) f.report(id, 'idle')
  f.director.start()
  f.director.setInteractionLocks(ambientNpcIds)
  assert.equal(f.timers.size, 0)
  f.director.setInteractionLocks(['mira', 'cat'])
  assert.equal(f.timers.size, 1)
  assert.equal(chooseAmbientEvent(createInitialNpcActivities(), ['kai'], () => 0, ['mira','cat']).npcId, 'kai')
  assert.equal(chooseAmbientEvent(createInitialNpcActivities(), [], () => 0, ambientNpcIds), null)
  f.fire()
  f.director.setInteractionLocks(['kai']) // active journey is not cancelled
  assert.equal(f.timers.size, 0)
  f.report('kai', 'idle')
  assert.equal(f.timers.size, 1)
  f.director.stop()
})
