// Test-only virtual interval clock: no real waits or production scheduling hooks.
import React, { act, StrictMode, useLayoutEffect } from 'react'
import { useNpcActivities } from '../src/hooks/useNpcActivities.js'
import { createInitialNpcActivities } from '../src/data/npcActivities.js'

export function installIntervalClock() {
  const originalSet = window.setInterval
  const originalClear = window.clearInterval
  const timers = new Map()
  let now = 0
  let serial = 0
  window.setInterval = (callback, delay) => {
    const id = ++serial
    timers.set(id, { callback, delay, due: now + delay })
    return id
  }
  window.clearInterval = id => timers.delete(id)
  return {
    timers,
    get created() { return serial },
    async tick(milliseconds) {
      const target = now + milliseconds
      while (timers.size) {
        const next = [...timers.values()].sort((a, b) => a.due - b.due)[0]
        if (next.due > target) break
        now = next.due
        next.due += next.delay
        await act(async () => next.callback())
      }
      now = target
    },
    restore() { window.setInterval = originalSet; window.clearInterval = originalClear },
  }
}

export async function verifyAmbientRuntime(root, check, clock) {
  let runtime
  function Harness({ intervals }) {
    const value = useNpcActivities({ intervals })
    useLayoutEffect(() => { runtime = value })
    return null
  }
  const render = intervals => act(async () => root.render(<StrictMode><Harness intervals={intervals} /></StrictMode>))
  const initial = () => JSON.stringify(runtime.activities) === JSON.stringify(createInitialNpcActivities())
  await render({ kai: 37, mira: 53, cat: 71 })
  check(initial(), 'ambient hook starts all three NPCs at their initial activity')
  check(clock.timers.size === 3 && clock.created === 6, 'Strict Mode setup/cleanup leaves exactly three live intervals')
  await clock.tick(36)
  check(initial(), 'no ambient activity changes before the first deadline')
  await clock.tick(1)
  check(runtime.getNpcActivity('kai') === 'making_coffee' && runtime.getNpcActivity('mira') === 'reading_notes' && runtime.getNpcActivity('cat') === 'sleeping', 'Kai timer advances only Kai')
  await clock.tick(16)
  check(runtime.getNpcActivity('mira') === 'checking_phone' && runtime.getNpcActivity('cat') === 'sleeping', 'Mira timer advances separately')
  await clock.tick(18)
  check(runtime.getNpcActivity('cat') === 'grooming', 'Cat has an independent timer')
  await act(async () => {
    runtime.advanceNpcActivity('kai')
    runtime.advanceNpcActivity('kai')
    runtime.setNpcActivity('cat', 'watching_door')
  })
  check(runtime.getNpcActivity('kai') === 'looking_out_window' && runtime.getNpcActivity('cat') === 'watching_door', 'batched ambient updates use the latest immutable state')
  let rejected = 0
  for (const operation of [() => runtime.getNpcActivity('unknown'), () => runtime.setNpcActivity('kai', 'sleeping'), () => runtime.advanceNpcActivity('unknown')]) {
    try { operation() } catch (error) { if (error instanceof RangeError) rejected++ }
  }
  check(rejected === 3, 'hook APIs reject unknown NPCs and mismatched activities')
  const created = clock.created
  await act(async () => runtime.resetNpcActivities())
  check(initial() && clock.created === created, 'reset restores all activities without restarting timers')
  await render({ kai: 37, mira: 53, cat: 71 })
  check(clock.created === created, 'equivalent interval props and rerenders do not recreate timers')
  const oldTimers = [...clock.timers.keys()]
  await render({ kai: 41, mira: 59, cat: 73 })
  check(clock.timers.size === 3 && oldTimers.every(id => !clock.timers.has(id)), 'changing intervals cleans up every previous timer')
  await act(async () => root.render(null))
  check(clock.timers.size === 0, 'unmount cleans up all ambient timers')
  const before = runtime.activities
  await clock.tick(10000)
  check(runtime.activities === before, 'no late ambient updates after unmount')
  await render({ kai: 37, mira: 53, cat: 71 })
  check(initial() && clock.timers.size === 3, 'new session starts fresh without accumulating timers')
  await act(async () => root.render(null))
}
