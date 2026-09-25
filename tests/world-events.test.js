import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorldEvents } from '../src/game/worldEvents.js'
import { createAmbientDirector } from '../src/game/ambientDirector.js'

function clock() {
  let time = 0, serial = 0
  const jobs = new Map()
  return { now: () => time, jobs,
    setTimer: (fn, ms) => { jobs.set(++serial, { fn, at: time + ms }); return serial },
    clearTimer: id => jobs.delete(id),
    tick(ms) {
      const end = time + ms
      while (true) {
        const next = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        jobs.delete(next[0]); time = next[1].at; next[1].fn()
      }
      time = end
    },
  }
}
function fixture(random = () => 0) {
  const c = clock(), events = [], speech = [], assignments = [], ambient = [], debug = []
  let activities = { kai: 'behind_counter', mira: 'reading_notes', cat: 'grooming' }
  const assign = (id, activity) => { activities = { ...activities, [id]: activity }; assignments.push({ id, activity }) }
  const director = createAmbientDirector({ getActivities: () => activities,
    onActivity: (id, activity) => { ambient.push({ id, activity }); assign(id, activity) }, random: () => 0, ...c })
  const world = createWorldEvents({ director, getActivities: () => activities, assign,
    onEvent: e => events.push(e), onSpeech: e => speech.push(e), onDebug: e => debug.push(e), random, ...c })
  const report = (id, phase, destination) => { const m = { phase, destination }; director.reportMovement(id, m); world.report(id, m) }
  director.start(); world.start()
  report('kai', 'idle', 'counter'); report('mira', 'idle', 'notes_spot'); report('cat', 'idle', 'floor')
  return { c, events, speech, assignments, ambient, debug, director, world, report, assign }
}

test('environment survives busy reservation, expires, and ignores stale callbacks', () => {
  const f = fixture(); f.director.reserve('counter-social')
  f.world.trigger('rain_intensifies')
  assert.equal(f.world.getRecentWorldEvent(), 'rain_intensifies')
  assert.equal(f.assignments.length, 0)
  const stale = [...f.c.jobs.values()].find(j => j.at === 30000).fn
  f.c.tick(1000); f.world.trigger('rain_softens'); stale()
  assert.equal(f.world.getRecentWorldEvent(), 'rain_softens')
  f.c.tick(29999); assert.equal(f.world.getRecentWorldEvent(), 'rain_softens')
  f.c.tick(1); assert.equal(f.world.getRecentWorldEvent(), undefined)
  assert.equal(f.events.at(-1), null)
  f.world.stop(); f.director.stop(); assert.equal(f.c.jobs.size, 0)
})
test('quiet lull stays quiet, first opportunity is delayed and start/stop is idempotent', () => {
  const f = fixture(); f.director.reserve('counter-social'); f.world.start()
  f.c.tick(44999); assert.equal(f.events.length, 0)
  f.c.tick(1); assert.equal(f.events.length, 1)
  const first = f.events[0].id
  f.c.tick(45000); assert.notEqual(f.events.at(-1)?.id, first)
  f.world.trigger('quiet_lull'); assert.equal(f.speech.filter(Boolean).length, 0)
  const stale = [...f.c.jobs.values()].map(j => j.fn)
  f.world.stop(); f.world.start(); stale.forEach(fn => fn())
  assert.equal(f.world.getRecentWorldEvent(), undefined)
  f.world.stop(); f.director.stop()
})
test('one counter bark reserves then restores ordinary scheduling', () => {
  const f = fixture(); f.world.trigger('door_noise')
  assert.equal(f.assignments.length, 0)
  assert.equal(f.speech.at(-1).npcId, 'kai')
  assert.equal(f.director.reserve('another'), false)
  f.c.tick(2499); assert.ok(f.speech.at(-1))
  f.c.tick(1); assert.equal(f.speech.at(-1), null)
  f.c.tick(8000); assert.equal(f.ambient.length, 1)
  f.world.stop(); f.director.stop()
})
test('reaction and bark draws have independent 50 percent thresholds', () => {
  const noReaction = fixture(() => 0.5); noReaction.world.trigger('door_noise')
  assert.equal(noReaction.speech.filter(Boolean).length, 0)
  const draws = [0.1, 0, 0.5]
  const noBark = fixture(() => draws.shift() ?? 0)
  // Start consumed one timing draw; specify reaction, candidate, bark explicitly.
  draws.splice(0, draws.length, 0.1, 0, 0.5)
  noBark.world.trigger('door_noise')
  assert.equal(noBark.speech.filter(Boolean).length, 0)
  assert.equal(noBark.director.reserve('other'), true)
  for (const f of [noReaction, noBark]) { f.world.stop(); f.director.stop() }
})
test('Mira waits for correct arrival and player interaction cancels only world ownership', () => {
  const f = fixture(); f.world.setInteractionLocks(['kai', 'cat'])
  f.world.trigger('rain_intensifies')
  assert.deepEqual(f.assignments, [{ id: 'mira', activity: 'staring_out_window' }])
  f.report('mira', 'idle', 'notes_spot'); assert.equal(f.speech.filter(Boolean).length, 0)
  f.report('mira', 'walking', 'window'); assert.equal(f.director.reserve('other'), false)
  f.report('mira', 'idle', 'window'); assert.equal(f.speech.at(-1).npcId, 'mira')
  const stale = [...f.c.jobs.values()].find(j => j.at === 2500).fn
  f.world.setInteractionLocks(['mira']); assert.equal(f.speech.at(-1), null)
  assert.equal(f.director.reserve('counter-social'), true)
  stale(); assert.equal(f.director.reserve('other'), false)
  f.world.stop(); f.director.stop()
})
test('external reassignment cannot leave a stale world reaction or override activity', () => {
  const f = fixture(); f.world.setInteractionLocks(['kai', 'cat']); f.world.trigger('rain_intensifies')
  f.assign('mira', 'checking_phone'); f.report('mira', 'idle', 'notes_spot')
  assert.equal(f.speech.filter(Boolean).length, 0)
  assert.equal(f.director.reserve('counter-social'), true)
  assert.equal(f.assignments.at(-1).activity, 'checking_phone')
  f.world.stop(); f.director.stop()
})
test('Cat behavior never speaks and new events cannot cause concurrent movement', () => {
  const f = fixture(); f.world.setInteractionLocks(['kai', 'mira']); f.world.trigger('door_noise')
  assert.deepEqual(f.assignments, [{ id: 'cat', activity: 'watching_door' }])
  f.report('cat', 'walking', 'door'); f.world.trigger('rain_intensifies')
  assert.equal(f.assignments.length, 1)
  f.report('cat', 'idle', 'door'); assert.equal(f.speech.filter(Boolean).length, 0)
  f.world.stop(); f.director.stop()
})

test('two rapid events cannot dispatch two NPCs before the first movement report', () => {
  const f = fixture()
  f.world.setInteractionLocks(['kai', 'cat'])
  f.world.trigger('rain_intensifies')
  assert.deepEqual(f.assignments, [{ id: 'mira', activity: 'staring_out_window' }])
  f.world.setInteractionLocks(['kai'])
  f.world.trigger('door_noise')
  assert.equal(f.assignments.length, 1, 'Mira dispatch must remain reserved until movement acknowledges it')
  f.report('mira', 'idle', 'notes_spot')
  assert.equal(f.director.reserve('counter-social'), false, 'old idle report cannot release dispatch reservation')
  f.report('mira', 'walking', 'window')
  f.world.trigger('door_noise')
  assert.equal(f.assignments.length, 1)
  f.report('mira', 'idle', 'window')
  assert.equal(f.speech.filter(Boolean).length, 0, 'cancelled old event cannot bark about the replacement event')
  assert.equal(f.director.reserve('counter-social'), true)
  f.world.stop(); f.director.stop()
})
test('reassignment during a settled bark cleans the stale line and reservation', () => {
  const f = fixture(); f.world.trigger('door_noise')
  assert.ok(f.speech.at(-1))
  f.assign('kai', 'making_coffee'); f.report('kai', 'walking', 'coffee_station')
  assert.equal(f.speech.at(-1), null)
  f.report('kai', 'idle', 'coffee_station')
  assert.equal(f.director.reserve('counter-return'), true)
  f.world.stop(); f.director.stop()
})
