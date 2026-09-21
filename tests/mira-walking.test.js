import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { sceneWaypoints, sceneWaypointEdges, getNpcWaypoint } from '../src/data/sceneWaypoints.js'
import { npcSceneAnchors } from '../src/data/npcSceneAnchors.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { resolveNpcRoute, resolveInterruptedRoute } from '../src/game/npcRoute.js'
import { getMiraWalkingVisual, miraWalkingRegistration } from '../src/data/miraWalking.js'
import { getHumanSceneDepth } from '../src/game/sceneDepth.js'
import { HUMAN_MOVEMENT, KAI_MOVEMENT } from '../src/game/npcMovement.js'

const locations = Object.keys(npcSceneAnchors.mira)
for (const from of locations) for (const to of locations) {
  test(`Mira ${from} → ${to}: connected deterministic route to her own anchor`, () => {
    const start = getNpcWaypoint('mira', from), end = getNpcWaypoint('mira', to)
    const route = resolveNpcRoute(start, end)
    assert.deepEqual(route, resolveNpcRoute(start, end))
    if (from === to) { assert.deepEqual(route, []); return }
    const anchor = npcSceneAnchors.mira[to]
    assert.equal(route.at(-1).id, end)
    for (const key of ['x','y','scale','zIndex']) assert.equal(route.at(-1)[key], anchor[key])
    const nodes = [sceneWaypoints[start], ...route]
    nodes.slice(1).forEach((point, index) => {
      assert.notEqual(point.id, nodes[index].id)
      assert.ok(sceneWaypointEdges.some(edge => edge.includes(point.id) && edge.includes(nodes[index].id)))
      assert.deepEqual({scale:point.scale,zIndex:point.zIndex}, getHumanSceneDepth(point))
      assert.equal(point.zone, 'floor', 'Mira stays in public aisles')
    })
  })
}

test('Mira activity semantics and shared human cadence are preserved', () => {
  for (const [activity, location] of Object.entries({reading_notes:'notes_spot',checking_phone:'notes_spot',choosing_drink:'fridge',staring_out_window:'window'})) {
    assert.equal(getNpcSceneLocation('mira', activity), location)
  }
  assert.equal(HUMAN_MOVEMENT, KAI_MOVEMENT)
  assert.equal(getNpcWaypoint('kai','window'), 'window')
  assert.equal(getNpcWaypoint('mira','window'), 'mira_window')
  for(const [npc, location] of [['cat','floor'],['mira','counter'],['kai','notes_spot'],['mira','__proto__']]) {
    assert.throws(() => getNpcWaypoint(npc,location), RangeError)
  }
})

test('Mira interruption returns to an endpoint of her occupied corridor', () => {
  const a=sceneWaypoints.mira_notes_spot, b=sceneWaypoints.fridge_front
  const position={x:(a.x+b.x)/2,y:(a.y+b.y)/2}
  for(const location of locations) {
    const route=resolveInterruptedRoute(a.id,b.id,position,getNpcWaypoint('mira',location))
    assert.ok([a.id,b.id].includes(route[0].id))
    assert.equal(route.at(-1).id,getNpcWaypoint('mira',location))
  }
})

for(const direction of ['left','right','front','back']) {
  test(`Mira ${direction}: registered transparent four-frame sheet`, () => {
    const visual=getMiraWalkingVisual(direction)
    assert.equal(visual.mirrored,direction==='left')
    const png=readFileSync(new URL(`../public${visual.src}`,import.meta.url))
    assert.equal(png.readUInt32BE(16),2048)
    assert.equal(png.readUInt32BE(20),768)
    assert.equal(png[25],6)
    assert.deepEqual(visual.centers,[256,256,256,256])
    assert.deepEqual(visual.bottoms,[736,736,736,736])
    assert.equal(visual.height,720)
  })
}
test('Mira registration keeps her idle/walk bottom padding and source sprite', () => {
  assert.equal(getMiraWalkingVisual(null),null)
  assert.equal(parseFloat(miraWalkingRegistration.visibleHeight)+parseFloat(miraWalkingRegistration.bottom),886/911*100)
  const original=readFileSync(new URL('../public/assets/npcs/mira.png',import.meta.url))
  assert.equal(createHash('sha256').update(original).digest('hex'),'91043e45c6ba5dfc2e9060c7ad89cc44a14b0433ce595d9bfb33375d2986ede4')
})

test('Mira leaf additions preserve every Kai route and all accepted walking assets', () => {
  const chain=['coffee_station','counter','counter_lane','counter_exit','shelf','fridge_front','window_lane','door_lane','window']
  for(const from of Object.keys(npcSceneAnchors.kai)) for(const to of Object.keys(npcSceneAnchors.kai)) {
    const a=chain.indexOf(from),b=chain.indexOf(to)
    const expected=a===b?[]:a<b?chain.slice(a+1,b+1):chain.slice(b,a).reverse()
    assert.deepEqual(resolveNpcRoute(from,to).map(node=>node.id),expected)
  }
  const hashes={
    'kai.png':'bc66237db3df02d9e894ff2e0f16d86d3448bec251ed9c16dccfa375b5466755',
    'kai/kai-walk-side.png':'255cecd2427e4533c646cdcc65ac3c3e070acf76a9e9466b0ebaf05739146778',
    'kai/kai-walk-front.png':'7d77b3e33e8266e6961e61271e7b14a3d7d915d00a1a6382f62b13f7cba36596',
    'kai/kai-walk-back.png':'8809c979676c13f1de789f892376ce2a417a3f3495c60803975a0fc332d3bbb8',
  }
  for(const [file,hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(`../public/assets/npcs/${file}`,import.meta.url))).digest('hex'),hash)
})
