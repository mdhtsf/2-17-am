import React, { act, StrictMode } from 'react'
import NPC from '../src/components/NPC.jsx'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { sceneWaypoints } from '../src/data/sceneWaypoints.js'
import { getMovementDirection, getMovementDuration, KAI_MOVEMENT, WALK_CYCLE_MS } from '../src/game/npcMovement.js'
import { resolveNpcRoute } from '../src/game/npcRoute.js'

export async function verifyRoutes(root, container, check) {
  const originalSet = window.setTimeout
  const originalClear = window.clearTimeout
  const timers = new Map()
  window.setTimeout = (callback, delay, ...args) => {
    const id = originalSet(() => { timers.delete(id); callback(...args) }, delay)
    if (delay === KAI_MOVEMENT.settleMs || delay >= KAI_MOVEMENT.minDurationMs + KAI_MOVEMENT.completionGraceMs
      && (delay - KAI_MOVEMENT.completionGraceMs) % WALK_CYCLE_MS === 0) timers.set(id, callback)
    return id
  }
  window.clearTimeout = id => { timers.delete(id); originalClear(id) }
  let movement
  const observe = value => { movement = value }
  let clicks = 0
  const render = destination => act(async () => root.render(<StrictMode>
    <div style={{position:'relative', width:1000, height:1000 / 1.5}}>
      <NPC npc={{id:'kai',name:'KAI'}} visual={npcVisuals.kai} anchor={sceneWaypoints[destination]}
        logicalLocation={destination} onMovementChange={observe} onSelect={() => clicks++} />
    </div>
  </StrictMode>))
  const finishSegment = entity => act(async () => {
    entity.getAnimations().forEach(animation => animation.finish())
    await new Promise(resolve => originalSet(resolve, 30))
  })
  try {
    await render('counter')
    const entity = container.querySelector('.npc-kai')
    const shadow = entity.querySelector('.kai-ground-shadow')
    check(Boolean(shadow) && getComputedStyle(shadow).pointerEvents === 'none', 'Kai has a non-intercepting ground shadow inside his entity')
    await render('window')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      check(movement.phase === 'idle' && timers.size === 0, 'reduced motion goes directly to final anchor without route timers')
    } else {
      const expected = resolveNpcRoute('counter','window')
      const walk = entity.querySelector('.kai-walk')
      const firstFrame = walk.querySelector('.kai-walk-frame')
      const frameAnimation = firstFrame.getAnimations()[0]
      let previous = sceneWaypoints.counter
      for (const next of expected) {
        check(movement.phase === 'walking' && movement.segmentTo === next.id, `route walks sequentially toward ${next.id} without an idle flash`)
        check(movement.direction === getMovementDirection(previous,next), `${next.id}: direction comes from this segment`)
        check(parseFloat(entity.style.getPropertyValue('--npc-move-duration')) === getMovementDuration(previous,next), `${next.id}: route reuses the centralized speed model`)
        check(entity.querySelector('.kai-walk') === walk && firstFrame.getAnimations()[0] === frameAnimation, `${next.id}: step animation continues without remount or restart`)
        check(timers.size === 1, `${next.id}: exactly one completion timer`)
        const animations = entity.getAnimations()
        const duration = getMovementDuration(previous,next)
        animations.forEach(animation => { animation.pause(); animation.currentTime = duration / 2 })
        const rect = entity.getBoundingClientRect()
        const parent = entity.offsetParent.getBoundingClientRect()
        check(Math.abs(rect.bottom - parent.top - parent.height * (previous.y + next.y) / 200) < 1
          && Math.abs(rect.left + rect.width / 2 - parent.left - parent.width * (previous.x + next.x) / 200) < 1, `${next.id}: foot anchor remains on the path during scale interpolation`)
        const scale = new DOMMatrixReadOnly(getComputedStyle(entity).transform).a
        check(Math.abs(scale - (previous.scale + next.scale) / 2) < .002, `${next.id}: perspective scale interpolates continuously`)
        const shadowRect = shadow.getBoundingClientRect()
        check(Math.abs(shadowRect.left + shadowRect.width / 2 - (rect.left + rect.width / 2)) < 1
          && rect.bottom - shadowRect.bottom < rect.height * .03, `${next.id}: shadow follows the scaled foot anchor`)
        await act(async () => entity.click())
        await finishSegment(entity)
        previous = next
      }
      check(clicks === expected.length && movement.phase === 'settling', 'Kai stays clickable throughout route and settles only at final arrival')
      await act(async () => { await new Promise(resolve => originalSet(resolve, KAI_MOVEMENT.settleMs + 30)) })
      check(movement.phase === 'idle' && timers.size === 0 && !entity.querySelector('.kai-walk'), 'full route completion leaves idle with no timers')
      await render('counter')
      const obsolete = [...timers.values()][0]
      const before = getComputedStyle(entity).left
      await render('shelf')
      await act(async () => obsolete())
      check(movement.destination === 'shelf' && movement.phase === 'walking' && timers.size === 1, 'latest destination replaces old route and rejects its stale completion')
      check(Math.abs(parseFloat(getComputedStyle(entity).left) - parseFloat(before)) < 5, 'replanning keeps the current position on the occupied corridor')
      check(movement.route.at(-1) === 'shelf' && !movement.route.includes('counter'), 'interruption discards abandoned destination nodes')
    }
    await act(async () => root.render(null))
    check(timers.size === 0, 'unmount cancels route and settle lifecycle timers')
  } finally {
    await act(async () => root.render(null))
    window.setTimeout = originalSet
    window.clearTimeout = originalClear
  }
}
