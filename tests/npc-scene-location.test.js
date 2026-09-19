import test from 'node:test'
import assert from 'node:assert/strict'
import { npcActivities, createInitialNpcActivities } from '../src/data/npcActivities.js'
import { npcActivityLocations, npcSceneLocations } from '../src/data/npcSceneLocations.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { nextNpcActivity } from '../src/game/npcActivityTransitions.js'
import { createInitialNpcState } from '../src/data/npcState.js'
import { sendChat } from '../src/lib/chat.js'
import { scene } from '../src/data/scene.js'

const expectedCycles = {
  kai: ['counter', 'coffee_station', 'shelf', 'window'],
  mira: ['notes_spot', 'notes_spot', 'fridge', 'window'],
  cat: ['floor', 'floor', 'door', 'aisle'],
}

test('baked artwork and original hotspot coordinates stay independent of logical locations', () => {
  assert.equal(scene.src, '/assets/scenes/after-hours.png')
  assert.deepEqual(scene.hotspots.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })), [
    { id: 'kai', x: 25.65, y: 29.88, width: 5.21, height: 13.96 },
    { id: 'mira', x: 55.34, y: 31.74, width: 6.25, height: 22.27 },
    { id: 'cat', x: 29.62, y: 58, width: 6.32, height: 5.96 },
  ])
})

for (const npcId of Object.keys(npcActivities)) {
  test(`${npcId}: every valid activity deterministically derives the expected valid location`, () => {
    assert.deepEqual(Object.keys(npcActivityLocations[npcId]), npcActivities[npcId])
    const initial = createInitialNpcActivities()[npcId]
    let activity = initial
    for (const expected of expectedCycles[npcId]) {
      assert.equal(getNpcSceneLocation(npcId, activity), expected)
      assert.equal(getNpcSceneLocation(npcId, activity), expected)
      assert.ok(npcSceneLocations[npcId].includes(expected))
      activity = nextNpcActivity(npcId, activity)
    }
    assert.equal(activity, initial)
    assert.equal(getNpcSceneLocation(npcId, activity), expectedCycles[npcId][0])
  })

  test(`${npcId}: rejects invalid and other NPC activities without mutating config`, () => {
    for (const activity of [null, undefined, '', '__proto__', 'constructor', 0, {}, [],
      ...Object.keys(npcActivities).filter(id => id !== npcId).flatMap(id => npcActivities[id])]) {
      assert.throws(() => getNpcSceneLocation(npcId, activity), RangeError)
    }
    assert.throws(() => { npcActivityLocations[npcId][npcActivities[npcId][0]] = 'invalid' }, TypeError)
    assert.throws(() => { npcSceneLocations[npcId].push('invalid') }, TypeError)
  })
}

test('unknown NPCs cannot access location mappings', () => {
  for (const npcId of [null, undefined, '', 'unknown', '__proto__', 'constructor']) {
    assert.throws(() => getNpcSceneLocation(npcId, 'sleeping'), RangeError)
  }
})

test('derivation is isolated and does not mutate ambient or relationship snapshots', () => {
  const activities = createInitialNpcActivities()
  const relationship = createInitialNpcState()
  const before = structuredClone({ activities, relationship })
  const kaiActivity = nextNpcActivity('kai', activities.kai)
  assert.equal(getNpcSceneLocation('kai', kaiActivity), 'coffee_station')
  assert.equal(getNpcSceneLocation('mira', activities.mira), 'notes_spot')
  assert.equal(getNpcSceneLocation('cat', activities.cat), 'floor')
  assert.deepEqual({ activities, relationship }, before)
})

test('dialogue payload ignores activity and derived location for every dialogue NPC activity', async t => {
  const relationship = createInitialNpcState()
  const requests = []
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    requests.push(JSON.parse(options.body))
    return Response.json({ reply: '嗯。' })
  })
  for (const npc of ['kai', 'mira']) {
    for (const currentActivity of npcActivities[npc]) {
      const history = [{ role: 'user', content: '你好' }, { role: 'assistant', content: '嗯。' }]
      const request = { npc, message: '雨还没停。', history, npcState: relationship[npc] }
      await sendChat({ ...request, currentActivity, logicalLocation: getNpcSceneLocation(npc, currentActivity) })
      assert.deepEqual(requests.at(-1), request)
    }
  }
})
