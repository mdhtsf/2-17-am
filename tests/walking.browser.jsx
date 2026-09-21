import React, { act, StrictMode } from 'react'
import NPC from '../src/components/NPC.jsx'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { KAI_MOVEMENT, WALK_FRAME_MS, WALK_CYCLE_MS } from '../src/game/npcMovement.js'

export async function verifyWalking(root, container, check) {
  const originalSet = window.setTimeout
  const originalClear = window.clearTimeout
  const timers = new Map()
  let nextId = -1000
  window.setTimeout = (callback, delay, ...args) => {
    const completion = delay >= KAI_MOVEMENT.minDurationMs + KAI_MOVEMENT.completionGraceMs
      && delay <= KAI_MOVEMENT.maxDurationMs + KAI_MOVEMENT.completionGraceMs
      && (delay - KAI_MOVEMENT.completionGraceMs) % WALK_CYCLE_MS === 0
    if (!completion && delay !== KAI_MOVEMENT.settleMs) return originalSet(callback, delay, ...args)
    const id = nextId--
    timers.set(id, callback)
    return id
  }
  window.clearTimeout = id => { if (!timers.delete(id)) originalClear(id) }
  const clicks = []
  const render = (x, y) => act(async () => root.render(<StrictMode>
    <div style={{ position: 'relative', width: 1000, height: 600 }}>
      {['kai', 'mira', 'cat'].map((id, index) => <NPC key={id} npc={{ id, name: id.toUpperCase() }}
        visual={npcVisuals[id]} anchor={{ x: id === 'kai' ? x : 60 + index * 10, y: id === 'kai' ? y : 50, scale: 1, zIndex: 3 }}
        onSelect={() => clicks.push(id)} />)}
    </div>
  </StrictMode>))
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    await render(50, 50)
    const entity = container.querySelector('.npc-kai')
    const idle = entity.querySelector('.npc-sprite')
    const others = [...container.querySelectorAll('.npc-mira, .npc-cat')].map(node => node.outerHTML)
    check(idle.getAttribute('src') === '/assets/npcs/kai.png' && !entity.querySelector('.kai-walk') && timers.size === 0, 'Kai mounts idle in Strict Mode without movement timers')
    let staleCompletion
    let frameBounds
    for (const [x, y, direction, sheet] of [[70, 50, 'right', 'side'], [40, 50, 'left', 'side'], [40, 80, 'front', 'front'], [40, 20, 'back', 'back'], [80, 20, 'right', 'side']]) {
      await render(x, y)
      if (staleCompletion) await act(async () => staleCompletion())
      check(entity === container.querySelector('.npc-kai') && entity.contains(idle) && entity.contains(entity.querySelector('.npc-label')), `${direction}: visual, label and hotspot retain entity identity`)
      if (reduced) {
        check(!entity.querySelector('.kai-walk') && timers.size === 0, `${direction}: reduced motion stays idle`)
      } else {
        check(entity.querySelector('.kai-visual').dataset.direction === direction && timers.size === 1, `${direction}: interruption replaces the previous movement timer`)
        staleCompletion = [...timers.values()][0]
        const walk = entity.querySelector('.kai-walk')
        const currentBounds = [walk.offsetWidth, walk.offsetHeight, walk.offsetTop]
        check(!frameBounds || currentBounds.every((value, index) => Math.abs(value - frameBounds[index]) < 1), `${direction}: walking frame box and foot baseline remain fixed across sheets`)
        frameBounds = currentBounds
        const frames = [...entity.querySelectorAll('.kai-walk-frame')]
        check(frames.length === 4 && frames.every(frame => frame.querySelector('img').getAttribute('src').endsWith(`kai-walk-${sheet}.png`)), `${direction}: correct four-frame sheet`)
        check(entity.querySelector('.kai-walk').style.getPropertyValue('--walk-mirror') === (direction === 'left' ? '-1' : '1'), `${direction}: mirror is correct`)
        check(getComputedStyle(idle).opacity === '0' && frames.every(frame => getComputedStyle(frame).animationDuration === '0.5s'), `${direction}: idle yields to 8fps walking without changing layout`)
        // Sample every frame without waiting on real time, including registration geometry.
        await act(async () => {
          await Promise.all(frames.map(frame => frame.querySelector('img').decode()))
          const animations = frames.map(frame => frame.getAnimations()[0])
          animations.forEach(animation => animation.pause())
          for (let step = 0; step < 4; step++) {
            animations.forEach(animation => { animation.currentTime = step * WALK_FRAME_MS + 1 })
            check(walk.offsetTop + walk.offsetHeight === currentBounds[2] + currentBounds[1], `${direction}: frame ${step} preserves the ground baseline`)
            check(frames.filter(frame => getComputedStyle(frame).opacity === '1').length === 1, `${direction}: frame ${step} has exactly one visible pose`)
          }
        })
      }
      await act(async () => entity.click())
      check(clicks.at(-1) === 'kai', `${direction}: moving Kai stays clickable`)
      check([...container.querySelectorAll('.npc-mira, .npc-cat')].every((node, index) => node.outerHTML === others[index]), `${direction}: Mira and Cat remain unchanged`)
    }
    await act(async () => { for (const callback of [...timers.values()]) callback() })
    if (!reduced) {
      check(entity.querySelector('.kai-visual').dataset.phase === 'settling' && timers.size === 1, 'arrival enters one brief settle lifecycle')
      check([...entity.querySelectorAll('.kai-walk-frame')].every(frame => frame.getAnimations().length === 0), 'arrival stops frame cycling before settling')
      await act(async () => { for (const callback of [...timers.values()]) callback() })
    }
    check(!entity.querySelector('.kai-walk') && getComputedStyle(idle).opacity === '1' && timers.size === 0, `settle restores idle and leaves no pending timers (walk=${Boolean(entity.querySelector('.kai-walk'))}, opacity=${getComputedStyle(idle).opacity}, timers=${timers.size})`)
    await render(80, 20)
    check(timers.size === 0 && !entity.querySelector('.kai-walk'), 'same anchor does not restart walking')
    await act(async () => entity.click())
    check(clicks.at(-1) === 'kai', 'Kai remains clickable after arrival')
    await render(30, 20)
    if (!reduced) {
      await act(async () => { for (const callback of [...timers.values()]) callback() })
      const staleSettle = [...timers.values()][0]
      await render(90, 20)
      await act(async () => staleSettle())
      check(entity.querySelector('.kai-visual').dataset.phase === 'walking' && timers.size === 1, 'new movement also cancels an obsolete settle callback')
    }
    await act(async () => root.render(null))
    check(timers.size === 0, 'unmount cancels the active movement timer')
    await render(30, 20)
    check(timers.size === 0 && !container.querySelector('.kai-walk'), 'Strict Mode remount starts idle without stale playback')
  } finally {
    await act(async () => root.render(null))
    window.setTimeout = originalSet
    window.clearTimeout = originalClear
  }
}
