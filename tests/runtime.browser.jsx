import { verifySpriteReadiness } from './sprite-readiness.browser.jsx'
import { verifyInteractionCoherence } from './interaction-coherence.browser.jsx'
import { npcSpriteAssets } from '../src/data/npcSpriteAssets.js'
import { loadSprite } from '../src/lib/spriteAssets.js'
import { npcActivities } from '../shared/npcActivities.js'
import { verifyActivityVisuals } from './activity-visuals.browser.jsx'
import { verifyShelfOcclusion } from './shelf-occlusion.browser.jsx'
import { verifyCatMovement } from './cat-movement.browser.jsx'
// Standalone test page only; never imported by the game or production build.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { installAmbientClock, verifyAmbientRuntime } from './ambient.browser.jsx'
import { verifySceneLocations, checkSceneEntities } from './scene-locations.browser.jsx'
import { verifyRoutes } from './routes.browser.jsx'
import { verifyWalking } from './walking.browser.jsx'
import { verifyMovementHarness } from './movement-harness.browser.jsx'
import { verifyCounterFrames } from './counter-frames.browser.jsx'
import '../src/styles.css'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const output = document.getElementById('results')
const container = document.getElementById('test-root')
const root = createRoot(container)
const intervalClock = installAmbientClock()
const checks = []
const check = (condition, label) => {
  if (!condition) throw new Error(label)
  checks.push(label)
}
const requests = []
let mode = 'success'
let pending
let expireRequest
const originalSetTimeout = window.setTimeout
window.setTimeout = (callback, delay, ...args) => {
  if (delay === 60000) expireRequest = callback
  return originalSetTimeout(callback, delay, ...args)
}
const originalFetch = window.fetch
// No request can escape this fixture to a real model.
window.fetch = async (url, options) => {
  if (url !== '/api/chat') throw new Error('Unexpected test request')
  const body = JSON.parse(options.body)
  requests.push(body)
  const result = () => Response.json({ reply: `${body.npc}: ${body.message}` })
  if (mode === 'deferred') return new Promise(resolve => { pending = () => resolve(result()) })
  if (mode === 'timeout') return new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Mock timeout', 'AbortError')), { once: true })
  })
  if (mode === 'rejected') throw new TypeError('Mock network failure')
  if (mode === 'invalid') return Response.json({ reply: '' })
  if (mode === 'error') return Response.json({ error: 'mock unavailable' }, { status: 502 })
  return result()
}
const click = selector => act(async () => container.querySelector(selector).click())
const fill = text => act(async () => {
  const input = container.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
const submit = () => act(async () => container.querySelector('form').requestSubmit())
const say = async text => { await fill(text); await submit() }
const spoken = () => container.querySelector('.spoken').textContent

try {
  await Promise.all(npcSpriteAssets.map(loadSprite))
  await verifySpriteReadiness(root, container, check)
  await verifyInteractionCoherence(root, container, check, intervalClock)
  await verifyActivityVisuals(root, container, check)
  await verifyShelfOcclusion(root, container, check)
  await verifyCatMovement(root, container, check)
  await verifyCounterFrames(root, container, check)
  await verifyRoutes(root, container, check)
  await verifyRoutes(root, container, check, 'mira')
  await verifyMovementHarness(root, container, check, intervalClock)
  await verifyWalking(root, container, check)
  await verifyWalking(root, container, check, 'mira')
  await verifySceneLocations(root, container, check)
  await verifyAmbientRuntime(root, container, check, intervalClock)
  await act(async () => root.render(<App />))
  check(!container.querySelector('.movement-controls'), 'normal game never displays the development movement harness')
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.location).join(',') === 'counter,notes_spot,floor', 'App initial scene derives locations from initial activities')
  const sceneBefore = container.querySelector('.scene-art').outerHTML
  const positionsBefore = [...container.querySelectorAll('.npc')].map(node => node.getAttribute('style')).join('|')
  await intervalClock.tick(8000)
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.activity).join(',') === 'making_coffee,reading_notes,sleeping', 'App director changes exactly one activity through scene hotspots')
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.location).join(',') === 'coffee_station,notes_spot,floor', 'App timer advances derived locations without storing another state')
  check(requests.length === 0, 'automatic ambient ticks never request dialogue')
  check(positionsBefore !== [...container.querySelectorAll('.npc')].map(node => node.getAttribute('style')).join('|'), 'ambient location changes update the moving entity instead of leaving a fixed hotspot')
  checkSceneEntities(container, check, 'App automatic movement')
  check(sceneBefore === container.querySelector('.scene-art').outerHTML, 'movement keeps background framing and artwork unchanged')
  await click('.npc-kai')
  check(spoken() === '还没睡？', 'Kai panel opens normally')
  await click('.replies button')
  await fill('  ')
  check(container.querySelector('[aria-label="发送"]').disabled, 'empty input cannot send')
  await submit()
  await fill('今晚忙吗？')
  await intervalClock.tick(37000)
  check(container.querySelector('input').value === '今晚忙吗？' && spoken().length > 0, 'ambient tick preserves an open panel and its draft')
  await act(async () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })
    container.querySelector('input').dispatchEvent(event)
    check(event.defaultPrevented, 'IME confirmation Enter does not submit')
  })
  mode = 'deferred'
  await submit()
  await submit()
  await intervalClock.tick(71000)
  check(container.querySelector('[aria-label="发送"]').disabled, 'ambient ticks do not cancel or restart a pending dialogue')
  check(requests.length === 1 && container.querySelector('[aria-label="发送"]').disabled, 'loading prevents duplicate requests')
  await act(async () => pending())
  check(spoken() === 'kai: 今晚忙吗？', 'mock reply is displayed')
  mode = 'success'
  await say('我叫西瓜。')
  check(requests[1].history.length === 2 && requests[1].history[0].role === 'user', 'second turn sends the prior conversation')
  await click('.npc-mira')
  check(spoken() === '你看起来也没怎么睡。', 'Mira panel opens normally')
  await say('论文怎么样？')
  check(requests[2].npc === 'mira' && requests[2].history.length === 0, 'Mira does not receive Kai history')
  mode = 'error'
  await say('还要多久？')
  check(Boolean(container.querySelector('[role="alert"]')) && container.querySelector('input').value === '还要多久？', 'failure preserves draft and shows retry feedback')
  check(spoken() === 'mira: 论文怎么样？', 'failure preserves the last reply')
  mode = 'success'
  await submit()
  check(requests[3].history.length === 2 && requests[4].history.length === 2, 'retry does not include a failed turn')
  await click('.npc-kai')
  check(spoken() === 'kai: 我叫西瓜。', 'returning to Kai preserves his conversation')
  mode = 'deferred'
  await say('取消这句')
  await click('.npc-mira')
  await act(async () => pending())
  check(spoken() === 'mira: 还要多久？', 'cancelled response cannot cross NPCs')
  await click('.close-dialogue')
  check(!container.querySelector('.dialogue'), 'DialoguePanel closes')
  await click('.npc-kai')
  check(spoken() === 'kai: 我叫西瓜。', 'closing preserves successful history and excludes cancelled turns')
  for (const failureMode of ['rejected', 'invalid', 'timeout']) {
    mode = failureMode
    await say('这句失败')
    if (mode === 'timeout') await act(async () => expireRequest())
  }
  // A late response may already be buffered when cancellation fires.
  mode = 'deferred'
  await say('超时后才到达')
  await act(async () => { expireRequest(); pending() })
  check(spoken() === 'kai: 我叫西瓜。' && Boolean(container.querySelector('[role="alert"]')), 'late timed-out reply preserves history and uses existing error UI')
  const beforeInvalid = requests.length
  await say('x'.repeat(1001))
  check(requests.length === beforeInvalid, 'oversize input never calls API')
  mode = 'success'
  for (let index = 0; index < 10; index++) await say(`第 ${index} 句`)
  check(requests.at(-1).history.length === 20, 'history remains capped at 20 messages')
  await click('.npc-mira')
  await say('再聊一会儿')
  await say('接着刚才的话')
  check(requests.every(request => Object.keys(request).sort().join(',') === 'activity,history,message,npc'), 'requests contain semantic activity only, never rendering data')
  check(requests.every(request => npcActivities[request.npc].includes(request.activity)), 'each request contains only its own NPC valid activity')
  check(requests.every(request => request.history.every(entry => (entry.role === 'user' || entry.role === 'assistant') && Object.keys(entry).sort().join(',') === 'content,role')), 'history never contains system messages or state context')
  check(!/trust|familiarity|deadlineStress|hasMetPlayer|exhausted|neutral/.test(container.textContent), 'game has no runtime debug UI')
  check(!/behind_counter|making_coffee|checking_phone|grooming|currentActivity/.test(container.textContent), 'ambient activities have no visible debug labels')
  const requestsBeforeCat = requests.length
  await click('.npc-cat')
  check(container.querySelector('.cat-feedback').textContent.includes('没什么意思'), 'Cat keeps local feedback')
  check(requests.length === requestsBeforeCat, 'moving Cat interaction remains local-only')
  await act(async () => root.render(<App key="new-page-session" />))
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.activity).join(',') === 'behind_counter,reading_notes,sleeping' && intervalClock.timers.size === 1, 'App remount resets all activities and replaces old timers')
  await click('.npc-kai')
  await say('新一轮')
  check(requests.at(-1).history.length === 0, 'new page lifetime clears conversation history')
  output.dataset.result = 'passed'
  output.textContent = JSON.stringify({ passed: checks.length, checks }, null, 2)
} catch (error) {
  output.dataset.result = 'failed'
  output.textContent = JSON.stringify({ passed: checks.length, error: error.message, checks }, null, 2)
} finally {
  await act(async () => root.unmount())
  window.fetch = originalFetch
  window.setTimeout = originalSetTimeout
  intervalClock.restore()
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
}
