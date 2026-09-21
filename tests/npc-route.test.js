import test from 'node:test'
import assert from 'node:assert/strict'
import { sceneWaypoints as points, sceneWaypointEdges as edges } from '../src/data/sceneWaypoints.js'
import { npcSceneAnchors } from '../src/data/npcSceneAnchors.js'
import { resolveNpcRoute, resolveInterruptedRoute } from '../src/game/npcRoute.js'
import { getKaiSceneDepth, getSegmentLayer } from '../src/game/sceneDepth.js'
import { getMovementDuration } from '../src/game/npcMovement.js'

const names = Object.keys(npcSceneAnchors.kai)
for (const from of names) for (const to of names) {
  test(`${from} → ${to}: deterministic immutable corridor route`, () => {
    const route = resolveNpcRoute(from, to)
    assert.deepEqual(route, resolveNpcRoute(points[from], points[to]))
    if (from === to) { assert.deepEqual(route, []); return }
    assert.equal(route.at(-1), points[to])
    assert.equal(route.at(-1).x, npcSceneAnchors.kai[to].x)
    assert.equal(route.at(-1).y, npcSceneAnchors.kai[to].y)
    const full = [points[from], ...route]
    full.slice(1).forEach((point, i) => {
      assert.notEqual(point.id, full[i].id)
      assert.ok(edges.some(edge => edge.includes(full[i].id) && edge.includes(point.id)))
      assert.ok(getMovementDuration(full[i], point) > 0)
      assert.throws(() => { point.x++ }, TypeError)
    })
    if (points[from].zone !== points[to].zone) assert.ok(full.some(point => point.id === 'counter_exit'))
    route.pop()
    assert.equal(resolveNpcRoute(from, to).at(-1), points[to], 'caller cannot mutate graph paths')
  })
}
test('representative paths use the counter opening and the outside shelf lane', () => {
  assert.deepEqual(resolveNpcRoute('counter', 'window').map(point => point.id),
    ['counter_lane', 'counter_exit', 'shelf', 'fridge_front', 'window_lane', 'door_lane', 'window'])
  for (const forbidden of [['counter','shelf'],['counter','window'],['coffee_station','fridge_front'],['shelf','window']]) {
    assert.ok(!edges.some(edge => forbidden.every(id => edge.includes(id))))
  }
})
test('unknown nodes, anchors and non-edges fail clearly', () => {
  for (const invalid of [undefined, null, '__proto__', 'unknown', {}, { x: 0, y: 0 }]) {
    assert.throws(() => resolveNpcRoute(invalid, 'window'), RangeError)
    assert.throws(() => resolveNpcRoute('counter', invalid), RangeError)
  }
  assert.throws(() => resolveInterruptedRoute('counter', 'window', {x: 30,y:55}, 'shelf'), RangeError)
})
test('mid-route changes only continue or reverse the occupied edge', () => {
  const position = {x: 66, y: 59.2}
  for (const target of names) {
    const route = resolveInterruptedRoute('fridge_front', 'window_lane', position, target)
    assert.ok(['fridge_front', 'window_lane'].includes(route[0].id))
    assert.equal(route.at(-1).id, target)
    assert.deepEqual(route, resolveInterruptedRoute('fridge_front', 'window_lane', position, target))
  }
  assert.equal(resolveInterruptedRoute('fridge_front', 'window_lane', position, 'shelf')[0].id, 'fridge_front')
  assert.equal(resolveInterruptedRoute('fridge_front', 'window_lane', position, 'window')[0].id, 'window_lane')
})
test('Kai scale and depth are bounded, monotonic and reconciled with anchors', () => {
  let previous = 0
  for (let y = 0; y <= 100; y++) {
    const {scale} = getKaiSceneDepth({y})
    assert.ok(scale >= previous && scale >= .92 && scale <= 1.06)
    if (previous) assert.ok(scale - previous < .005)
    previous = scale
  }
  for (const name of names) {
    assert.equal(points[name].scale, npcSceneAnchors.kai[name].scale)
    assert.equal(points[name].zIndex, npcSceneAnchors.kai[name].zIndex)
  }
  assert.equal(getSegmentLayer(points.counter_lane, points.counter_exit), 1)
  assert.equal(getSegmentLayer(points.counter_exit, points.counter_lane), 1)
  assert.ok(getSegmentLayer(points.window_lane, points.door_lane) > 2)
})

test('authored public routes clear conservative furniture footprints', () => {
  // Test-only art-space ground footprints; no runtime collision engine.
  const furniture = [
    [[42,63],[59,83],[66,79],[66,62],[48,50]], // central product shelf
    [[51,25],[72,40],[72,56],[51,42]], // refrigerator bank
    [[32,86],[52,100],[60,96],[52,82],[38,70]], // foreground shelf
    [[74,56],[78,59],[78,64],[74,62]], // plant / umbrella stand
  ]
  const inside = (point, polygon) => {
    let hit = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [x, y] = polygon[i], [px, py] = polygon[j]
      if ((y > point.y) !== (py > point.y) && point.x < (px - x) * (point.y - y) / (py - y) + x) hit = !hit
    }
    return hit
  }
  for (const [from, to] of edges) for (let step = 0; step <= 100; step++) {
    const t = step / 100
    const position = {x: points[from].x * (1-t) + points[to].x * t, y: points[from].y * (1-t) + points[to].y * t}
    assert.ok(furniture.every(polygon => !inside(position, polygon)), `${from} → ${to} crosses furniture`)
  }
})

test('interruption resolver rejects off-corridor positions and zero-length edges', () => {
  assert.throws(() => resolveInterruptedRoute('counter', 'counter', points.counter, 'window'), RangeError)
  assert.throws(() => resolveInterruptedRoute('fridge_front', 'window_lane', points.counter, 'window'), RangeError)
})
