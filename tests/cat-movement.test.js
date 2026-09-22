import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { CAT_MOVEMENT, catVisual, catPoses, getCatWalkingVisual } from '../src/data/catVisuals.js'
import { npcSceneAnchors } from '../src/data/npcSceneAnchors.js'
import { sceneWaypoints, getNpcWaypoint } from '../src/data/sceneWaypoints.js'
import { resolveNpcRoute, resolveInterruptedRoute } from '../src/game/npcRoute.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { getMovementDuration, HUMAN_MOVEMENT } from '../src/game/npcMovement.js'
import { getCatSceneDepth } from '../src/game/sceneDepth.js'

test('Cat activities keep their locations and same-location changes have no route', () => {
  for (const [activity, location] of Object.entries({ sleeping: 'floor', grooming: 'floor', watching_door: 'door', wandering: 'aisle' })) {
    assert.equal(getNpcSceneLocation('cat', activity), location)
  }
  assert.deepEqual(resolveNpcRoute('cat_floor', 'cat_floor'), [])
})

for (const from of Object.keys(npcSceneAnchors.cat)) for (const to of Object.keys(npcSceneAnchors.cat)) {
  test(`Cat ${from} → ${to}: deterministic route to registered ground anchor`, () => {
    const start = getNpcWaypoint('cat', from), target = getNpcWaypoint('cat', to)
    const route = resolveNpcRoute(start, target)
    assert.deepEqual(route, resolveNpcRoute(start, target))
    if (from === to) return assert.equal(route.length, 0)
    for (const key of ['x', 'y', 'scale', 'zIndex']) assert.equal(route.at(-1)[key], npcSceneAnchors.cat[to][key])
    assert.ok(route.every(node => node.id.startsWith('cat_') && node.zone === 'floor'))
  })
}

test('Cat crosses the shelf-front lane, never a direct line through the shelf', () => {
  assert.deepEqual(resolveNpcRoute('cat_floor', 'cat_door').map(node => node.id),
    ['cat_shelf_corner', 'cat_front_lane', 'cat_outer_lane', 'cat_door'])
  const a = sceneWaypoints.cat_shelf_corner, b = sceneWaypoints.cat_front_lane
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  for (const target of ['cat_floor', 'cat_door', 'cat_aisle']) {
    const route = resolveInterruptedRoute(a.id, b.id, middle, target)
    assert.ok([a.id, b.id].includes(route[0].id))
    assert.equal(route.at(-1).id, target)
  }
})

test('Cat has an independent cadence and continuous bounded perspective', () => {
  assert.equal(CAT_MOVEMENT.pixelsPerSecond, 125)
  assert.equal(HUMAN_MOVEMENT.pixelsPerSecond, 155)
  const a = { x: 0, y: 0 }, b = { x: 30, y: 0 }
  assert.ok(getMovementDuration(a, b, CAT_MOVEMENT) > getMovementDuration(a, b))
  let previous = 0
  for (let y = 0; y <= 100; y += .1) {
    const { scale } = getCatSceneDepth({ y })
    assert.ok(scale >= previous && scale >= .85 && scale <= 1.05)
    previous = scale
  }
  assert.deepEqual(catVisual.groundAnchor, { x: .5, y: 1 })
  assert.equal(catVisual.sceneWidth * 186 / 224, 6.12)
})

for (const [name, src] of Object.entries(catPoses)) {
  test(`Cat ${name}: transparent registered activity canvas`, () => {
    const png = readFileSync(new URL(`../public${src}`, import.meta.url))
    assert.equal(png.readUInt32BE(16), 224)
    assert.equal(png.readUInt32BE(20), 192)
    assert.equal(png[25], 6)
  })
}
for (const direction of ['left', 'right', 'front', 'back']) {
  test(`Cat ${direction}: independent four-paw sheet`, () => {
    const visual = getCatWalkingVisual(direction)
    const png = readFileSync(new URL(`../public${visual.src}`, import.meta.url))
    assert.equal(png.readUInt32BE(16), 224 * CAT_MOVEMENT.frames)
    assert.equal(png.readUInt32BE(20), 192)
    assert.equal(png[25], 6)
    assert.equal(visual.mirrored, direction === 'left')
  })
}

test('original Cat art remains available and unchanged', () => {
  const original = readFileSync(new URL('../public/assets/npcs/cat.png', import.meta.url))
  assert.equal(createHash('sha256').update(original).digest('hex'), 'e59e52e2ee8542e541d82f0c981c3ee039ff6e6a2bff1f4435cde5c4055d8cf3')
})
