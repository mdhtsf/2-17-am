import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getMovementDirection, getMovementDistance, getMovementDuration, KAI_MOVEMENT, WALK_CYCLE_MS, MIN_WALK_DISTANCE } from '../src/game/npcMovement.js'
import { getKaiWalkingVisual } from '../src/data/kaiWalking.js'

test('direction uses the dominant anchor axis and does not mutate anchors', () => {
  const start = Object.freeze({ x: 50, y: 50 })
  for (const [x, y, expected] of [[40, 52, 'left'], [60, 48, 'right'], [52, 70, 'front'], [48, 30, 'back'], [60, 60, 'right'], [50, 50, null]]) {
    assert.equal(getMovementDirection(start, Object.freeze({ x, y })), expected)
  }
})

test('direction selects the right sheet and only left is mirrored', () => {
  assert.equal(getKaiWalkingVisual(null), null)
  for (const direction of ['left', 'right', 'front', 'back']) {
    const visual = getKaiWalkingVisual(direction)
    assert.equal(visual.mirrored, direction === 'left')
    assert.equal(visual.src, `/assets/npcs/kai/kai-walk-${['left', 'right'].includes(direction) ? 'side' : direction}.png`)
    const png = readFileSync(new URL(`../public${visual.src}`, import.meta.url))
    assert.equal(png.readUInt32BE(16), 512 * 4)
    assert.equal(png.readUInt32BE(20), 768)
    assert.equal(png[25], 6)
    assert.equal(visual.centers.length, 4)
    assert.equal(visual.bottoms.length, 4)
    assert.ok(visual.bottoms.every(bottom => bottom <= 768 && bottom >= visual.height))
  }
})


test('Kai duration grows with art-space distance and ends on whole cycles', () => {
  const origin = { x: 0, y: 0 }
  const short = getMovementDuration(origin, { x: 10, y: 0 })
  const long = getMovementDuration(origin, { x: 40, y: 0 })
  assert.ok(long > short)
  assert.equal(long, short * 4)
  assert.equal(getMovementDistance(origin, { x: 10, y: 0 }), 153.6)
  assert.equal(getMovementDuration(origin, origin), 0)
  for (const x of [1, 10, 30, 60, 100]) {
    const duration = getMovementDuration(origin, { x, y: x })
    assert.equal(duration % WALK_CYCLE_MS, 0)
    assert.ok(duration >= KAI_MOVEMENT.minDurationMs && duration <= KAI_MOVEMENT.maxDurationMs)
  }
  assert.equal(getMovementDuration(origin, { x: 0.001, y: 0 }), 0)
  assert.equal(getMovementDuration(origin, { x: 100, y: 100 }), KAI_MOVEMENT.maxDurationMs)
})

test('only imperceptible endpoint corrections skip the walk cycle', () => {
  const origin = { x: 0, y: 0 }
  assert.equal(getMovementDuration(origin, { x: MIN_WALK_DISTANCE / 1536 * 100, y: 0 }), 0)
  assert.equal(getMovementDuration(origin, { x: (MIN_WALK_DISTANCE + 0.1) / 1536 * 100, y: 0 }), KAI_MOVEMENT.minDurationMs)
})

test('direction uses scene aspect and stays deterministic on diagonal segments', () => {
  const origin = { x: 0, y: 0 }
  for (let i = 0; i < 10; i++) assert.equal(getMovementDirection(origin, { x: 10, y: 12 }), 'right')
  assert.equal(getMovementDirection(origin, { x: 10, y: 20 }), 'front')
})
