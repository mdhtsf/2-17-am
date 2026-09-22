import React, { act, StrictMode } from 'react'
import NPC from '../src/components/NPC.jsx'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { getNpcSceneAnchor } from '../src/game/npcSceneAnchor.js'
import { CAT_MOVEMENT, getCatPose } from '../src/data/catVisuals.js'
import { getMovementDuration } from '../src/game/npcMovement.js'
import { sceneWaypoints, getNpcWaypoint } from '../src/data/sceneWaypoints.js'
import { resolveNpcRoute } from '../src/game/npcRoute.js'

export async function verifyCatMovement(root, container, check) {
  const originalSet = window.setTimeout, originalClear = window.clearTimeout
  const originalFetch = window.fetch
  const timers = new Map()
  let requests = 0, movement, clicks = 0
  window.fetch = async () => { requests++; throw new Error('Cat must stay local') }
  window.setTimeout = (callback, delay, ...args) => {
    const id = originalSet(() => { timers.delete(id); callback(...args) }, delay)
    if (delay === CAT_MOVEMENT.settleMs || delay >= 580 && (delay - 80) % 500 === 0) timers.set(id, callback)
    return id
  }
  window.clearTimeout = id => { timers.delete(id); originalClear(id) }
  const observe = value => { movement = value }
  const render = activity => act(async () => {
    const location = getNpcSceneLocation('cat', activity)
    root.render(<StrictMode><div style={{ position: 'relative', width: 900, height: 600 }}>
      <NPC npc={{ id: 'cat', name: 'THE CAT' }} visual={npcVisuals.cat}
        anchor={getNpcSceneAnchor('cat', location)} logicalLocation={location} currentActivity={activity}
        onMovementChange={observe} onSelect={() => clicks++} />
    </div></StrictMode>)
  })
  const finishSegment = entity => act(async () => {
    entity.getAnimations().forEach(animation => animation.finish())
    await new Promise(resolve => originalSet(resolve, 35))
  })
  try {
    await render('sleeping')
    const entity = container.querySelector('.npc-cat')
    const label = entity.querySelector('.npc-label')
    const style = entity.getAttribute('style')
    await render('grooming')
    check(movement.phase === 'idle' && timers.size === 0 && entity.getAnimations().length === 0,
      'Cat sleeping → grooming starts no route or movement timers')
    check(style === entity.getAttribute('style') && entity.querySelector('.npc-sprite').getAttribute('src') === getCatPose('grooming'),
      'Cat same-location activity changes only the local pose')
    let from = 'floor'
    for (const activity of ['watching_door', 'wandering', 'sleeping']) {
      const destination = getNpcSceneLocation('cat', activity)
      await render(activity)
      const expected = resolveNpcRoute(getNpcWaypoint('cat', from), getNpcWaypoint('cat', destination))
      let previous = sceneWaypoints[getNpcWaypoint('cat', from)]
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        for (const next of expected) {
          check(movement.phase === 'walking' && movement.segmentTo === next.id && entity.querySelector('.cat-visual').dataset.pose === 'walking',
            `Cat ${activity}: stays walking through ${next.id}`)
          const duration = getMovementDuration(previous, next, CAT_MOVEMENT)
          check(parseFloat(entity.style.getPropertyValue('--npc-move-duration')) === duration && timers.size === 1,
            `Cat ${next.id}: own cadence with one segment completion timer`)
          entity.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = duration / 2 })
          const box = entity.getBoundingClientRect(), parent = entity.offsetParent.getBoundingClientRect()
          check(Math.abs(box.bottom - parent.top - parent.height * (previous.y + next.y) / 200) < 1
            && Math.abs(box.left + box.width / 2 - parent.left - parent.width * (previous.x + next.x) / 200) < 1,
            `Cat ${next.id}: bottom-center ground anchor is stable`)
          const scale = new DOMMatrixReadOnly(getComputedStyle(entity).transform).a
          check(Math.abs(scale - (previous.scale + next.scale) / 2) < .002,
            `Cat ${next.id}: perspective interpolates with movement`)
          const img = entity.querySelector('.cat-walk img')
          const animation = img.getAnimations()[0]
          check(Boolean(animation), `Cat ${next.id}: quadruped animation is active`)
          const offsets = []
          for (let frame = 0; frame < 4; frame++) {
            animation.pause(); animation.currentTime = frame * 125 + 10
            offsets.push(new DOMMatrixReadOnly(getComputedStyle(img).transform).e)
          }
          check(new Set(offsets.map(value => Math.round(value))).size === 4,
            `Cat ${next.id}: all four different paw frames play`)
          animation.play()
          await act(async () => entity.click())
          await finishSegment(entity)
          previous = next
        }
        check(movement.phase === 'settling' && !entity.querySelector('.cat-walk'), 'Cat changes to activity pose only at final arrival')
        await act(async () => { await new Promise(resolve => originalSet(resolve, 160)) })
      }
      check(movement.phase === 'idle' && timers.size === 0 && entity.querySelector('.npc-sprite').getAttribute('src') === getCatPose(activity),
        `Cat arrives in ${activity} with no stale route`)
      check(entity.querySelector('.npc-label') === label && container.querySelectorAll('.npc-cat').length === 1,
        'Cat label and hotspot keep the same entity across activity changes')
      from = destination
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await render('watching_door')
      const obsolete = [...timers.values()][0]
      const duration = parseFloat(entity.style.getPropertyValue('--npc-move-duration'))
      entity.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = duration / 2 })
      const before = entity.getBoundingClientRect()
      await render('wandering')
      await act(async () => obsolete())
      const after = entity.getBoundingClientRect()
      check(Math.abs(before.bottom - after.bottom) < 2 && Math.abs(before.left - after.left) < 2,
        'Cat interruption starts at current visual position, without a teleport')
      check(movement.destination === 'aisle' && movement.route.at(-1) === 'cat_aisle' && timers.size === 1,
        'Cat newest target wins and stale route completion is ignored')
      for (let i = 0; i < 10 && movement.phase === 'walking'; i++) await finishSegment(entity)
      await act(async () => { await new Promise(resolve => originalSet(resolve, 160)) })
      check(movement.phase === 'idle' && entity.querySelector('.cat-visual').dataset.pose === 'wandering',
        'Cat interrupted route restores the latest activity pose')
      check(clicks > 0, 'Cat remains clickable while walking')
    }
    // The authored floor routes mostly face sideways. Exercise the other two
    // sheets in an isolated segment fixture without adding artificial world paths.
    await act(async () => root.render(null))
    const renderSegment = (x, y) => act(async () => root.render(<div style={{ position: 'relative', width: 900, height: 600 }}><NPC
      npc={{ id: 'cat', name: 'THE CAT' }} visual={npcVisuals.cat}
      anchor={{ x, y, scale: 1, zIndex: 4 }} currentActivity="wandering"
      onMovementChange={observe} onSelect={() => {}} /></div>))
    await renderSegment(50, 50)
    for (const [x, y, direction] of [[50, 70, 'front'], [50, 30, 'back'], [30, 30, 'left']]) {
      await renderSegment(x, y)
      const cat = container.querySelector('.npc-cat')
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const img = cat.querySelector('.cat-walk img')
        const facing = movement.direction // decode may finish after arrival in a background tab
        await img.decode()
        check(facing === direction && img.naturalWidth === 896 && img.naturalHeight === 192,
          `Cat ${direction}: directional sheet loads and renders at its registered dimensions (${facing}, ${img.naturalWidth}×${img.naturalHeight})`)
        await finishSegment(cat)
        await act(async () => { await new Promise(resolve => originalSet(resolve, 160)) })
      }
    }
    check(requests === 0, 'Cat movement and clicks never call chat/API')
  } finally {
    await act(async () => root.render(null))
    check(timers.size === 0, 'Cat unmount cancels all segment and arrival timers')
    window.setTimeout = originalSet; window.clearTimeout = originalClear; window.fetch = originalFetch
  }
}
