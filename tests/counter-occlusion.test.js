import test from 'node:test'
import assert from 'node:assert/strict'
import { counterOcclusionOutline, counterOcclusion } from '../src/data/counterOcclusion.js'
import { scene } from '../src/data/scene.js'
import { sceneWaypoints, sceneForegroundLayers } from '../src/data/sceneWaypoints.js'
import { getSegmentLayer } from '../src/game/sceneDepth.js'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { readFileSync } from 'node:fs'

const covered = ([x, y]) => {
  let inside = false
  for (let i = 0, j = counterOcclusionOutline.length - 1; i < counterOcclusionOutline.length; j = i++) {
    const [ax, ay] = counterOcclusionOutline[i]
    const [bx, by] = counterOcclusionOutline[j]
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}

test('counter foreground leaves the rear-cabinet band visible behind Kai', () => {
  // Art-space samples between the old broad diagonal and the real worktop.
  // Covering these pixels cuts Kai's torso off above the counter surface.
  for (const x of [348, 352, 356]) for (const y of [435, 440, 445, 450]) {
    assert.equal(covered([x, y]), false, `coffee lane ${x},${y} must not erase the sprite`)
  }
  for (const x of [418, 430, 440]) for (const y of [415, 420, 425, 430]) {
    assert.equal(covered([x, y]), false, `initial counter ${x},${y} must not erase the sprite`)
  }
  for (const point of [[485, 415], [520, 387], [600, 346], [710, 353]]) {
    assert.equal(covered(point), false, 'counter lane excludes rear shelves/background')
  }
})

test('outer counter rim and exit side pixels have no exposed strip', () => {
  // Measured lit-edge pixels from the unchanged artwork. The previous diagonal
  // was inside these points and let Kai show over the actual counter edge.
  const rim = [[415, 441], [420, 439], [425, 438], [430, 436], [435, 434],
    [440, 433], [445, 431], [450, 429], [455, 428], [460, 426], [465, 425],
    [470, 423], [475, 422], [480, 420], [485, 418], [490, 417], [495, 415],
    [500, 414], [505, 413], [510, 411], [515, 410], [520, 408], [525, 407],
    [530, 405], [535, 403]]
  for (const [x, y] of rim) {
    assert.equal(covered([x, y]), true, `rim ${x},${y} remains opaque`)
    assert.equal(covered([x, y - 5]), false, 'guard must not recreate the old empty background band')
  }
  for (const y of [421, 440, 460, 480, 490]) {
    assert.equal(covered([731, y]), true, 'outer side outline is covered')
    assert.equal(covered([735, y]), false, 'open-floor side stays clear')
  }
})

test('real worktop, till displays and merchandise continue to hide Kai', () => {
  // Independent samples on foreground objects, not generated from mask vertices.
  for (const point of [[352, 476], [435, 478], [490, 441], [390, 445], [566, 397], [602, 379], [658, 350], [710, 403]]) {
    assert.equal(covered(point), true, `foreground surface ${point} remains in front`)
  }
  for (const point of [[421, 448], [430, 447], [438, 445], [520, 418]]) {
    assert.equal(covered(point), true, 'solid worktop must not have notches around objects standing on it')
  }
  for (const id of ['coffee_station', 'counter', 'counter_lane']) {
    const { x, y } = sceneWaypoints[id]
    assert.equal(covered([x * scene.width / 100, y * scene.height / 100]), true, `${id}: hidden feet remain inside counter`)
  }
  for (const point of [[752, 470], [490, 595], [190, 550]]) {
    assert.equal(covered(point), false, 'mask stops at furniture instead of erasing public floor')
  }
})

test('counter mask and route layers preserve the shared art-space contract', () => {
  assert.equal(scene.counterOcclusion, counterOcclusion)
  assert.ok(counterOcclusionOutline.every(([x, y]) => x >= 0 && x <= scene.width && y >= 0 && y <= scene.height))
  assert.throws(() => { counterOcclusionOutline[0][0]++ }, TypeError)
  const foreground = sceneForegroundLayers.find(layer => layer.id === 'counter')
  for (const [a, b] of [['coffee_station', 'counter'], ['counter', 'counter_lane'], ['counter_lane', 'counter_exit']]) {
    assert.ok(getSegmentLayer(sceneWaypoints[a], sceneWaypoints[b]) < foreground.zIndex)
    assert.ok(getSegmentLayer(sceneWaypoints[b], sceneWaypoints[a]) < foreground.zIndex)
  }
  assert.ok(sceneWaypoints.counter_exit.zIndex < foreground.zIndex, 'exit local depth cannot bypass the foreground pass')
})

test('counter exit clears the widest accepted Kai walking silhouette', () => {
  const frames = JSON.parse(readFileSync(new URL('../art-source/kai-stage-4-2c-3/registration.json', import.meta.url)))
  const widest = Math.max(...frames.filter(frame => frame.row > 0).map(frame => frame.width))
  const kai = npcVisuals.kai
  const exit = sceneWaypoints.counter_exit
  const visibleHeight = scene.width * kai.sceneWidth / 100 * 928 / kai.width * exit.scale
  const leftmostPixel = exit.x * scene.width / 100 - widest / 2 * visibleHeight / 720
  const counterRight = Math.max(...counterOcclusionOutline.map(([x]) => x))
  assert.ok(leftmostPixel > counterRight + 3, 'whole walking pose clears the counter before entering open floor')
  assert.ok(exit.x < sceneWaypoints.shelf.x, 'opening stays before shelf, without doubling back')
})
