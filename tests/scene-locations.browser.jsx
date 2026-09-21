import { finishMovement } from './finishMovement.js'
import { sceneWaypoints } from '../src/data/sceneWaypoints.js'
import { getSegmentLayer } from '../src/game/sceneDepth.js'
import React, { act } from 'react'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { npcActivities } from '../src/data/npcActivities.js'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { getNpcSceneAnchor } from '../src/game/npcSceneAnchor.js'
import { getMovementDuration } from '../src/game/npcMovement.js'

// Stage 4.2B replaces no-movement assertions with moving-entity invariants.
export function checkSceneEntities(container, check, label) {
  const nodes = [...container.querySelectorAll('.npc')]
  check(nodes.length === 3 && container.querySelectorAll('.npc-sprite').length === 3, `${label}: exactly one sprite and hitbox per NPC`)
  check(nodes.every(node => {
    const id = node.className.match(/npc-(kai|mira|cat)/)[1]
    const visual = node.querySelector('.walking-visual')
    const active = visual?.dataset.phase === 'walking'
    const anchor = active ? sceneWaypoints[visual.dataset.waypoint] : getNpcSceneAnchor(id, node.dataset.location)
    const layer = active ? getSegmentLayer(sceneWaypoints[visual.dataset.segmentFrom], anchor) : anchor.zIndex
    return node.style.left === `${anchor.x}%` && node.style.top === `${anchor.y}%`
      && node.style.getPropertyValue('--npc-scale') === String(anchor.scale)
      && node.style.zIndex === String(layer)
      && node.querySelector('.npc-sprite').getAttribute('src') === npcVisuals[id].src
      && Boolean(node.querySelector('.npc-label'))
  }), `${label}: each sprite, label and hitbox share the derived anchor`)
}

export async function verifySceneLocations(root, container, check) {
  const expected = [
    ['counter', 'notes_spot', 'floor'],
    ['coffee_station', 'notes_spot', 'floor'],
    ['shelf', 'fridge', 'door'],
    ['window', 'window', 'aisle'],
  ]
  let background
  let previousNodes
  let previousStyles
  const clicks = []
  for (let step = 0; step < 4; step++) {
    const activities = Object.fromEntries(Object.entries(npcActivities).map(([id, cycle]) => [id, cycle[step]]))
    const before = JSON.stringify(activities)
    await act(async () => root.render(<ConvenienceStoreScene activities={activities} selectedId={null} catActive={false}
      onSelect={id => clicks.push(id)} onCat={() => clicks.push('cat')} />))
    const nodes = [...container.querySelectorAll('.npc')]
    check(nodes.map(node => node.dataset.location).join(',') === expected[step].join(','), `scene step ${step} derives correct isolated locations for all NPCs`)
    checkSceneEntities(container, check, `scene step ${step}`)
    if (step === 0) {
      background = container.querySelector('.scene-art').outerHTML
      check(container.querySelector('.scene-art').getAttribute('src') === '/assets/scenes/after-hours-clean.png', 'active background is the clean scene')
    }
    check(background === container.querySelector('.scene-art').outerHTML
      && !container.querySelector('img[src="/assets/scenes/after-hours.png"], img[src^="/art/"]'), `scene step ${step} preserves clean background without baked or legacy NPCs`)
    if (previousNodes) check(nodes.every((node, i) => node === previousNodes[i]), `scene step ${step} preserves entity identity without teleport remounts`)
    if (step === 1) {
      check(nodes[0].getAttribute('style') !== previousStyles[0], 'Kai changes target position when his location changes')
      check(nodes.slice(1).every((node, i) => node.getAttribute('style') === previousStyles[i + 1]), 'same-location Mira and Cat activities do not change visual position')
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const movement = nodes[0].getAnimations()
      check(reducedMotion ? movement.length === 0 : movement.length > 0 && movement.every(animation => animation.effect.getTiming().duration === getMovementDuration(getNpcSceneAnchor('kai', 'counter'), getNpcSceneAnchor('kai', 'coffee_station')) && animation.effect.getTiming().easing === 'linear'), 'changed location uses restrained CSS movement and respects reduced motion')
      check(nodes.slice(1).every(node => node.getAnimations().length === 0), 'same-location activities start no movement animation')
    }
    // Wait for CSS movement only, not for the ambient clock's real-world intervals.
    await finishMovement(nodes)
    const sceneBounds = container.querySelector('.scene').getBoundingClientRect()
    check(nodes.every(node => {
      const id = node.className.match(/npc-(kai|mira|cat)/)[1]
      const anchor = getNpcSceneAnchor(id, node.dataset.location)
      const box = node.getBoundingClientRect()
      return Math.abs(box.x + box.width / 2 - (sceneBounds.x + sceneBounds.width * anchor.x / 100)) < 1
        && Math.abs(box.bottom - (sceneBounds.y + sceneBounds.height * anchor.y / 100)) < 1
    }), `scene step ${step} resolves percentage anchors to the actual bottom-center position`)
    check(nodes.every(node => {
      const box = node.getBoundingClientRect()
      const sprite = node.querySelector('.npc-sprite').getBoundingClientRect()
      return Math.abs(box.x - sprite.x) < 1 && Math.abs(box.y - sprite.y) < 1 && Math.abs(box.width - sprite.width) < 1 && Math.abs(box.height - sprite.height) < 1
    }), `scene step ${step} hitboxes exactly follow sprite bounds after movement`)
    for (const node of nodes) await act(async () => node.click())
    check(clicks.slice(-3).join(',') === 'kai,mira,cat', `scene step ${step} click handlers remain attached to the correct NPCs`)
    check(JSON.stringify(activities) === before, `scene step ${step} does not mutate ambient state`)
    previousNodes = nodes
    previousStyles = nodes.map(node => node.getAttribute('style'))
  }
  check(!/logicalLocation|notes_spot|coffee_station|shelf_corner|aisle|window/.test(container.textContent), 'logical locations never appear in visible scene text')
  await act(async () => root.render(null))
}
