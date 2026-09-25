import test from 'node:test'
import assert from 'node:assert/strict'
import { worldEventDelay, getWorldReactionCandidates, chooseWorldBark } from '../src/data/worldEventReactions.js'
import { worldEventIds, validWorldEvent } from '../shared/worldEvents.js'
import { requireNpcActivity } from '../shared/npcActivities.js'

const activities = { kai: 'behind_counter', mira: 'reading_notes', cat: 'grooming' }
function reports(a = activities) {
  return new Map([
    ['kai', { phase: 'idle', destination: 'counter' }],
    ['mira', { phase: 'idle', destination: a.mira === 'choosing_drink' ? 'fridge' : 'notes_spot' }],
    ['cat', { phase: 'idle', destination: 'floor' }],
  ])
}
test('random opportunities have varied values within 45–90 seconds', () => {
  assert.equal(worldEventDelay(() => 0), 45000)
  assert.equal(worldEventDelay(() => 1 - Number.EPSILON), 90000)
  const values = Array.from({ length: 100 }, (_, i) => worldEventDelay(() => i / 100))
  assert.equal(new Set(values).size, 100)
  assert.ok(values.every(n => n >= 45000 && n <= 90000))
})
test('quiet lull, locked NPCs, and sleeping Cat do not react', () => {
  assert.deepEqual(getWorldReactionCandidates('quiet_lull', activities, reports(), []), [])
  assert.deepEqual(getWorldReactionCandidates('door_noise', { ...activities, cat: 'sleeping' }, reports(), ['kai']), [])
  assert.deepEqual(getWorldReactionCandidates('rain_intensifies', activities, reports(), ['kai', 'mira', 'cat']), [])
})
test('Kai only reacts from the arrived neutral counter pose', () => {
  for (const activity of ['making_coffee', 'checking_shelf', 'looking_out_window']) {
    assert.ok(!getWorldReactionCandidates('rain_intensifies', { ...activities, kai: activity }, reports(), []).some(c => c.npcId === 'kai'))
  }
  const moving = reports(); moving.set('kai', { phase: 'walking', destination: 'counter' })
  assert.ok(!getWorldReactionCandidates('door_noise', activities, moving, []).some(c => c.npcId === 'kai'))
  const kai = getWorldReactionCandidates('door_noise', activities, reports(), []).find(c => c.npcId === 'kai')
  assert.deepEqual(kai, { npcId: 'kai', activity: 'behind_counter', destination: 'counter' })
})
test('only four events remain; all candidates use existing activities', () => {
  assert.equal(validWorldEvent('fridge_hum'), false)
  assert.equal(worldEventIds.length, 4)
  for (const event of worldEventIds) for (const candidate of getWorldReactionCandidates(event, activities, reports(), [])) {
    assert.equal(requireNpcActivity(candidate.npcId, candidate.activity), candidate.activity)
  }
})
test('barks vary and never give the Cat or quiet lull a human line', () => {
  for (const event of worldEventIds) assert.equal(chooseWorldBark(event, 'cat', null, () => 0), null)
  assert.equal(chooseWorldBark('quiet_lull', 'mira', null, () => 0), null)
  const first = chooseWorldBark('rain_intensifies', 'kai', null, () => 0)
  assert.ok(first.length < 40)
  assert.notEqual(chooseWorldBark('rain_intensifies', 'kai', first, () => 0), first)
})

test('Cat across the store is not sent on a long world-reaction route', () => {
  const far = { ...activities, cat: 'wandering' }
  const farReports = reports(); farReports.set('cat', { phase: 'idle', destination: 'aisle' })
  assert.deepEqual(getWorldReactionCandidates('door_noise', far, farReports, ['kai']), [])
  const near = getWorldReactionCandidates('door_noise', activities, reports(), ['kai'])
  assert.deepEqual(near, [{ npcId: 'cat', activity: 'watching_door', destination: 'door' }])
})
