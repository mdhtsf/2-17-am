import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { npcSceneLocations } from '../src/data/npcSceneLocations.js'
import { npcActivities, createInitialNpcActivities } from '../src/data/npcActivities.js'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { getNpcSceneAnchor } from '../src/game/npcSceneAnchor.js'
import { nextNpcActivity } from '../src/game/npcActivityTransitions.js'
import { createInitialNpcState } from '../src/data/npcState.js'
import { sendChat } from '../src/lib/chat.js'

const assetHashes = {
  kai: 'bc66237db3df02d9e894ff2e0f16d86d3448bec251ed9c16dccfa375b5466755',
  mira: '1097fe34570d69cca96b4512ef3a65e55c81625d6d6f20b79b3ed9bb5ec49bb1',
  cat: '2f629a466a4fbca1f67fbde13dfdf3b675b4695becbe3cb6b2cc96ab44b0ecf0',
}
const sha256 = data => createHash('sha256').update(data).digest('hex')

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
  test(`${npcId}: registered transparent sprite matches its asset revision and dimensions`, () => {
    const visual = npcVisuals[npcId]
    assert.equal(visual.src, npcId === 'mira' ? '/assets/npcs/mira/mira-idle.png' : npcId === 'cat' ? '/assets/npcs/cat/cat-sleeping.png' : `/assets/npcs/${npcId}.png`)
    const png = readFileSync(new URL(`../public${visual.src}`, import.meta.url))
    assert.equal(sha256(png), assetHashes[npcId])
    assert.equal(png.readUInt32BE(16), visual.width)
    assert.equal(png.readUInt32BE(20), visual.height)
    assert.equal(png[25], 6, 'PNG has an alpha channel')
    assert.ok(visual.sceneWidth > 0 && visual.sceneWidth < 15)
  })
}

test('clean background is a byte-for-byte copy of the supplied asset', () => {
  assert.equal(sha256(readFileSync(new URL('../public/assets/scenes/after-hours-clean.png', import.meta.url))),
    '6af2c73443c18511ff14947a5f640b877662b7fb46741446cfc87caa0c51f9c5')
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
