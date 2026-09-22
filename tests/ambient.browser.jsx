// Only ambient deadlines are virtual. Fixed entropy selects the lower range
// bounds; movement/settle/API timers keep their real clock and existing tests.
import React, { act, StrictMode, useLayoutEffect } from 'react'
import { useNpcActivities } from '../src/hooks/useNpcActivities.js'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { createInitialNpcActivities } from '../src/data/npcActivities.js'
import { finishMovement } from './finishMovement.js'

export function installAmbientClock() {
  const originalSet = window.setTimeout
  const originalClear = window.clearTimeout
  const originalRandom = Math.random
  const timers = new Map()
  let draws = []
  let now = 0
  let serial = 0
  Math.random = () => draws.shift() ?? 0
  window.setTimeout = (callback, delay, ...args) => {
    if (delay !== 8000 && delay !== 16000) return originalSet(callback, delay, ...args)
    const id = --serial
    timers.set(id, { callback, delay, due: now + delay })
    return id
  }
  window.clearTimeout = id => { if (!timers.delete(id)) originalClear(id) }
  return {
    timers,
    get created() { return -serial },
    chooseCat() { draws = [0.99, 0] },
    async tick(milliseconds) {
      const target = now + milliseconds
      while (timers.size) {
        const [id, next] = [...timers].sort((a, b) => a[1].due - b[1].due)[0]
        if (next.due > target) break
        now = next.due
        timers.delete(id)
        await act(async () => next.callback())
      }
      now = target
    },
    restore() { window.setTimeout = originalSet; window.clearTimeout = originalClear; Math.random = originalRandom },
  }
}

export async function verifyAmbientRuntime(root, container, check, clock) {
  let runtime
  function Harness() {
    const value = useNpcActivities()
    useLayoutEffect(() => { runtime = value })
    return <ConvenienceStoreScene activities={value.activities} selectedId={null}
      onSelect={() => {}} onCat={() => {}} catActive={false}
      onKaiMovementChange={value.movementObservers.kai}
      onMiraMovementChange={value.movementObservers.mira}
      onCatMovementChange={value.movementObservers.cat} />
  }
  const render = () => act(async () => root.render(<StrictMode><Harness /></StrictMode>))
  const initial = () => JSON.stringify(runtime.activities) === JSON.stringify(createInitialNpcActivities())
  await render()
  check(initial(), 'director starts all three NPCs at initial activities')
  check(clock.timers.size === 1, 'Strict Mode leaves one central ambient timer')
  await clock.tick(7999)
  check(initial(), 'no ambient event before the first deadline')
  const untouched = ['mira', 'cat'].map(id => container.querySelector(`.npc-${id}`).outerHTML)
  await clock.tick(1)
  check(runtime.getNpcActivity('kai') === 'making_coffee' && runtime.getNpcActivity('mira') === 'reading_notes' && runtime.getNpcActivity('cat') === 'sleeping', 'first director event changes only Kai')
  check(['mira', 'cat'].every((id, i) => container.querySelector(`.npc-${id}`).outerHTML === untouched[i]), 'other NPC activities and poses remain unchanged')
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const duringTravel = runtime.activities
    check(clock.timers.size === 0, 'real walking renderer blocks ambient scheduling')
    await clock.tick(600000)
    check(runtime.activities === duringTravel, 'long virtual wait cannot start another NPC while Kai travels')
  }
  await finishMovement([container.querySelector('.npc-kai')])
  check(clock.timers.size === 1 && [...clock.timers.values()][0].delay === 16000, 'arrival and settling resume a fresh later interval')
  await clock.tick(15999)
  check(runtime.getNpcActivity('mira') === 'reading_notes', 'quiet interval is measured after arrival')
  await clock.tick(1)
  check(runtime.getNpcActivity('mira') === 'checking_phone', 'next event chooses a different NPC')
  check(container.querySelector('.mira-visual').dataset.phase === 'idle' && clock.timers.size === 1, 'same-location Mira activity acknowledges completion without walking or scheduler deadlock')
  clock.chooseCat()
  await clock.tick(16000)
  check(runtime.getNpcActivity('cat') === 'grooming' && clock.timers.size === 1, 'Cat same-location grooming pose resumes scheduling')
  const created = clock.created
  await render()
  check(clock.created === created && clock.timers.size === 1, 'rerenders do not restart the central timer')
  let rejected = 0
  for (const operation of [() => runtime.getNpcActivity('unknown'), () => runtime.setNpcActivity('kai', 'sleeping'), () => runtime.advanceNpcActivity('unknown')]) {
    try { operation() } catch (error) { if (error instanceof RangeError) rejected++ }
  }
  check(rejected === 3, 'manual activity APIs still reject invalid inputs')
  await act(async () => root.render(null))
  check(clock.timers.size === 0, 'unmount removes the central timer')
  const before = runtime.activities
  await clock.tick(100000)
  check(runtime.activities === before, 'unmounted director cannot make late changes')
  await render()
  check(initial() && clock.timers.size === 1, 'new session resets activities and director pacing')
  await act(async () => root.render(null))
}
