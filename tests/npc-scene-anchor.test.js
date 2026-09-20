import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { npcSceneLocations } from '../src/data/npcSceneLocations.js'
import { npcActivities, createInitialNpcActivities } from '../src/data/npcActivities.js'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { getNpcSceneAnchor } from '../src/game/npcSceneAnchor.js'
import { nextNpcActivity } from '../src/game/npcActivityTransitions.js'
import { createInitialNpcState } from '../src/data/npcState.js'
import { sendChat } from '../src/lib/chat.js'

for (const npcId of ['kai', 'mira', 'cat']) {
  test(`${npcId}: every logical location has an immutable percentage anchor`, () => {
    for (const location of npcSceneLocations[npcId]) {
      const anchor = getNpcSceneAnchor(npcId, location)
      assert.ok(Number.isFinite(anchor.x) && anchor.x >= 0 && anchor.x <= 100)
      assert.ok(Number.isFinite(anchor.y) && anchor.y >= 0 && anchor.y <= 100)
      assert.ok(anchor.scale > 0 && anchor.scale <= 2)
      assert.ok(Number.isInteger(anchor.zIndex) && anchor.zIndex > 0)
      assert.equal(getNpcSceneAnchor(npcId, location), anchor)
      assert.throws(() => { anchor.x++ }, TypeError)
    }
  })
  test(`${npcId}: activity cycles derive anchors and return to the same starting anchor`, () => {
    let activity = createInitialNpcActivities()[npcId]
    const first = getNpcSceneAnchor(npcId, getNpcSceneLocation(npcId, activity))
    for (const current of npcActivities[npcId]) {
      assert.equal(activity, current)
      assert.ok(getNpcSceneAnchor(npcId, getNpcSceneLocation(npcId, activity)))
      activity = nextNpcActivity(npcId, activity)
    }
    assert.equal(getNpcSceneAnchor(npcId, getNpcSceneLocation(npcId, activity)), first)
  })
  test(`${npcId}: provided transparent sprite is copied unchanged and has correct dimensions`, () => {
    const visual = npcVisuals[npcId]
    assert.equal(visual.src, `/assets/npcs/${npcId}.png`)
    const png = readFileSync(new URL(`../public${visual.src}`, import.meta.url))
    assert.deepEqual(png, readFileSync(new URL(`../public/assets/npcs/stage-4-2b-assets/${npcId}.png`, import.meta.url)))
    assert.equal(png.readUInt32BE(16), visual.width)
    assert.equal(png.readUInt32BE(20), visual.height)
    assert.equal(png[25], 6, 'PNG has an alpha channel')
    assert.ok(visual.sceneWidth > 0 && visual.sceneWidth < 15)
  })
}

test('clean background is a byte-for-byte copy of the supplied asset', () => {
  assert.deepEqual(readFileSync(new URL('../public/assets/scenes/after-hours-clean.png', import.meta.url)),
    readFileSync(new URL('../public/assets/npcs/stage-4-2b-assets/after-hours-clean.png', import.meta.url)))
})

test('invalid NPCs, locations, and cross-NPC locations are rejected', () => {
  for (const npc of [undefined, null, '__proto__', 'constructor', 'unknown', ['kai']]) {
    assert.throws(() => getNpcSceneAnchor(npc, 'counter'), RangeError)
  }
  for (const npc of Object.keys(npcSceneLocations)) {
    const others = Object.values(npcSceneLocations).flat().filter(location => !npcSceneLocations[npc].includes(location))
    for (const location of [undefined, null, '__proto__', 'constructor', '', {}, [], [npcSceneLocations[npc][0]], ...others]) {
      assert.throws(() => getNpcSceneAnchor(npc, location), RangeError)
    }
  }
})

test('same-location transitions reuse exactly the same anchor', () => {
  for (const [npc, first, second] of [['mira', 'reading_notes', 'checking_phone'], ['cat', 'sleeping', 'grooming']]) {
    assert.equal(getNpcSceneAnchor(npc, getNpcSceneLocation(npc, first)), getNpcSceneAnchor(npc, getNpcSceneLocation(npc, second)))
  }
})

test('visual derivation cannot affect relationship state or dialogue payload', async t => {
  const relationship = createInitialNpcState()
  const before = structuredClone(relationship)
  const requests = []
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    requests.push(JSON.parse(options.body))
    return Response.json({ reply: '嗯。' })
  })
  for (const npc of ['kai', 'mira']) {
    for (const currentActivity of npcActivities[npc]) {
      const logicalLocation = getNpcSceneLocation(npc, currentActivity)
      const anchor = getNpcSceneAnchor(npc, logicalLocation)
      const request = { npc, message: '你好', history: [], npcState: relationship[npc] }
      await sendChat({ ...request, currentActivity, logicalLocation, coordinates: anchor })
      assert.deepEqual(requests.at(-1), request)
    }
  }
  assert.deepEqual(relationship, before)
})
