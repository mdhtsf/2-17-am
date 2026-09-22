import test from 'node:test'
import assert from 'node:assert/strict'
import { shelfOcclusion, shelfOcclusionOutline } from '../src/data/shelfOcclusion.js'
import { scene } from '../src/data/scene.js'
import { sceneForegroundLayers } from '../src/data/sceneWaypoints.js'
import { npcSceneAnchors } from '../src/data/npcSceneAnchors.js'
import { resolveNpcRoute } from '../src/game/npcRoute.js'

const inside = ([x, y]) => {
  let hit = false
  for (let i = 0, j = shelfOcclusionOutline.length - 1; i < shelfOcclusionOutline.length; j = i++) {
    const [ax, ay] = shelfOcclusionOutline[i], [bx, by] = shelfOcclusionOutline[j]
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit
  }
  return hit
}

test('near shelf packages, sloping sign and end-cap bottles are foreground', () => {
  // Independent samples on actual products, including the reported overlap.
  for (const p of [[540, 686], [590, 660], [623, 684], [650, 718], [687, 735],
    [724, 756], [752, 784], [780, 804], [823, 837], [858, 886], [865, 905]]) {
    assert.equal(inside(p), true, `product pixel ${p} must hide Cat`)
  }
})

test('shelf mask excludes air above package steps, both route endpoints and exit floor', () => {
  for (const p of [[540, 650], [590, 633], [650, 683], [687, 705], [724, 721],
    [752, 741], [780, 755], [823, 800], [886, 900], [952, 896], [504, 645], [1275, 819]]) {
    assert.equal(inside(p), false, `clear pixel ${p} must not erase Cat`)
  }
})

test('shelf is a second registered original-image cutout, without replacing counter', () => {
  assert.equal(scene.shelfOcclusion, shelfOcclusion)
  assert.deepEqual(sceneForegroundLayers.find(layer => layer.id === 'counter'),
    { id: 'counter', zIndex: 6, mask: 'counterOcclusion' })
  assert.deepEqual(sceneForegroundLayers.find(layer => layer.id === 'merchandise-shelf'),
    { id: 'merchandise-shelf', zIndex: 6, mask: 'shelfOcclusion' })
  assert.equal(scene.src, '/assets/scenes/after-hours-clean.png')
  assert.ok(shelfOcclusionOutline.every(([x, y]) => x >= 0 && y >= 0 && x <= 1536 && y <= 1024))
  assert.throws(() => { shelfOcclusionOutline[0][0]++ }, TypeError)
})

test('occlusion correction preserves Cat route and forward/reverse ground anchors', () => {
  const forward = ['cat_floor', 'cat_shelf_corner', 'cat_front_lane', 'cat_outer_lane', 'cat_door']
  assert.deepEqual(resolveNpcRoute('cat_floor', 'cat_door').map(p => p.id), forward.slice(1))
  assert.deepEqual(resolveNpcRoute('cat_door', 'cat_floor').map(p => p.id), forward.slice(0, -1).reverse())
  assert.deepEqual([npcSceneAnchors.cat.floor.x, npcSceneAnchors.cat.floor.y], [32.8, 64.5])
  assert.deepEqual([npcSceneAnchors.cat.shelf_corner.x, npcSceneAnchors.cat.shelf_corner.y], [39.5, 65])
  assert.deepEqual([npcSceneAnchors.cat.door.x, npcSceneAnchors.cat.door.y], [83, 80])
})
