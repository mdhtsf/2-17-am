import React, { act, StrictMode } from 'react'
import App from '../src/App.jsx'
import { finishMovement } from './finishMovement.js'

export async function verifyFiniteActivities(root, container, check, clock) {
  const originalSet = window.setTimeout, originalClear = window.clearTimeout
  const originalFetch = window.fetch
  const timers = new Map()
  let id = -90000
  window.setTimeout = (fn, ms, ...args) => {
    if (ms !== 5000) return originalSet(fn, ms, ...args)
    timers.set(--id, fn); return id
  }
  window.clearTimeout = key => { if (!timers.delete(key)) originalClear(key) }
  try {
    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    await clock.tick(8000)
    const kai = container.querySelector('.npc-kai')
    check(kai.dataset.activity === 'making_coffee' && timers.size === 0, 'finite task has no countdown during travel')
    await finishMovement([kai])
    check(timers.size === 1 && kai.querySelector('.walking-visual').dataset.renderMode === 'activity', 'arrival starts one finite timer and coffee pose')
    await act(async () => kai.click())
    const position = kai.getAttribute('style')
    const directorTimers = [...clock.timers.keys()].join(',')
    const callback = [...timers.values()][0]
    timers.clear()
    await act(async () => { callback(); callback() })
    check(kai.dataset.activityComplete === 'true' && kai.querySelector('.walking-visual').dataset.renderMode === 'idle', 'task completion switches to neutral exactly once during dialogue lock')
    check(kai.dataset.activity === 'making_coffee' && kai.dataset.location === 'coffee_station' && kai.getAttribute('style') === position, 'completion preserves semantic assignment and current location without fake movement')
    check([...clock.timers.keys()].join(',') === directorTimers, 'finite timer does not reset or reschedule Ambient Director')
    check(container.querySelector('h2').textContent === 'KAI', 'finite completion preserves open dialogue')
    let payload
    window.fetch = async (_, options) => { payload = JSON.parse(options.body); return Response.json({ reply: '已经好了。' }) }
    await act(async () => {
      const input = container.querySelector('input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '咖啡好了吗？')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector('form').requestSubmit())
    check(!Object.hasOwn(payload, 'activity') && payload.npc === 'kai', 'completed task no longer sends an active coffee claim to dialogue')
    window.fetch = originalFetch
    await clock.tick(16000)
    check(kai.dataset.activity === 'making_coffee' && kai.dataset.activityComplete === 'true', 'completed Kai stays protected while other NPC changes activity')
    await act(async () => container.querySelector('.close-dialogue').click())
    check(kai.dataset.activity === 'behind_counter', 'unlock starts automatic cleanup return without another ambient selection')
    await finishMovement([kai])
    check(kai.dataset.location === 'counter' && kai.querySelector('.walking-visual').dataset.phase === 'idle', 'cleanup reaches counter and resumes idle')
    check(clock.timers.size === 1, 'normal ambient scheduling resumes after cleanup return')
    await act(async () => root.render(null))
    check(timers.size === 0, 'unmount clears finite timers')
  } finally { window.setTimeout = originalSet; window.clearTimeout = originalClear; window.fetch = originalFetch }
}
