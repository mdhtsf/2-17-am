// Standalone test page only; never imported by the game or production build.
import React, { act, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { useNpcStates } from '../src/hooks/useNpcStates.js'
import { createInitialNpcState } from '../src/data/npcState.js'
import { installIntervalClock, verifyAmbientRuntime } from './ambient.browser.jsx'
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
const intervalClock = installIntervalClock()
const checks = []
const check = (condition, label) => {
  if (!condition) throw new Error(label)
  checks.push(label)
}
let runtime
let select
function RuntimeHarness() {
  const state = useNpcStates()
  const [selected, setSelected] = useState(null)
  useLayoutEffect(() => { runtime = state; select = setSelected })
  return selected ? <span>{selected}</span> : null
}

const requests = []
const preRequestStates = []
let mode = 'success'
let pending
let observedStates
const observeState = states => { observedStates = states }
const checkState = (kai, mira, label) => {
  check(JSON.stringify(observedStates) === JSON.stringify({
    ...createInitialNpcState(),
    kai: { ...createInitialNpcState().kai, familiarity: kai, hasMetPlayer: kai > 0 },
    mira: { ...createInitialNpcState().mira, familiarity: mira, hasMetPlayer: mira > 0 },
  }), label)
}
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
  preRequestStates.push(structuredClone(observedStates[body.npc]))
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
  await verifyCounterFrames(root, container, check)
  await verifyRoutes(root, container, check)
  await verifyRoutes(root, container, check, 'mira')
  await verifyMovementHarness(root, container, check, intervalClock)
  await verifyWalking(root, container, check)
  await verifyWalking(root, container, check, 'mira')
  await verifySceneLocations(root, container, check)
  await verifyAmbientRuntime(root, check, intervalClock)
  await act(async () => root.render(<RuntimeHarness />))
  check(JSON.stringify(runtime.npcStates) === JSON.stringify(createInitialNpcState()), 'React initializes both NPC states')
  await act(async () => {
    runtime.updateNpcState('kai', state => ({ trust: state.trust + 1 }))
    runtime.updateNpcState('kai', state => ({ trust: state.trust + 1 }))
    runtime.updateNpcState('mira', () => ({ familiarity: 1 }))
  })
  check(runtime.getNpcState('kai').trust === 2, 'batched updates use the latest state')
  check(runtime.getNpcState('mira').trust === 0 && runtime.getNpcState('mira').familiarity === 1, 'React NPC states are isolated')
  for (const id of ['kai', 'mira', null, 'kai']) await act(async () => select(id))
  check(runtime.getNpcState('kai').trust === 2, 'selection and panel closure preserve runtime state')
  await act(async () => runtime.resetNpcState('kai'))
  check(runtime.getNpcState('kai').trust === 0 && runtime.getNpcState('mira').familiarity === 1, 'reset affects only the selected NPC')
  await act(async () => root.render(<RuntimeHarness key="new-page-session" />))
  check(JSON.stringify(runtime.npcStates) === JSON.stringify(createInitialNpcState()), 'new page lifetime starts from initial state')

  await act(async () => root.render(<App onNpcStateChange={observeState} />))
  check(!container.querySelector('.movement-controls'), 'normal game never displays the development movement harness')
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.location).join(',') === 'counter,notes_spot,floor', 'App initial scene derives locations from initial activities')
  const sceneBefore = container.querySelector('.scene-art').outerHTML
  const positionsBefore = [...container.querySelectorAll('.npc')].map(node => node.getAttribute('style')).join('|')
  await intervalClock.tick(71000)
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.activity).join(',') === 'making_coffee,checking_phone,grooming', 'App passes independently advancing activities into scene hotspots')
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.location).join(',') === 'coffee_station,notes_spot,floor', 'App timer advances derived locations without storing another state')
  checkState(0, 0, 'automatic ambient ticks do not change relationship state')
  check(requests.length === 0, 'automatic ambient ticks never request dialogue')
  check(positionsBefore !== [...container.querySelectorAll('.npc')].map(node => node.getAttribute('style')).join('|'), 'ambient location changes update the moving entity instead of leaving a fixed hotspot')
  checkSceneEntities(container, check, 'App automatic movement')
  check(sceneBefore === container.querySelector('.scene-art').outerHTML, 'movement keeps background framing and artwork unchanged')
  await click('.npc-kai')
  check(spoken() === '还没睡？', 'Kai panel opens normally')
  checkState(0, 0, 'opening Kai does not mark an encounter')
  await click('.replies button')
  checkState(0, 0, 'Stage 1 preset does not count as a completed dialogue')
  await fill('  ')
  check(container.querySelector('[aria-label="发送"]').disabled, 'empty input cannot send')
  await submit()
  checkState(0, 0, 'empty submission does not update state')
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
  checkState(0, 0, 'pending and duplicate submission do not update state')
  check(requests[0].npcState.familiarity === 0 && requests[0].npcState.hasMetPlayer === false, 'first Kai request sends stranger state before completion')
  await act(async () => pending())
  check(spoken() === 'kai: 今晚忙吗？', 'mock reply is displayed')
  checkState(1, 0, 'first successful reply marks Kai met and increments once')
  check(requests[0].npcState.familiarity === 0, 'successful transition cannot mutate an already sent state snapshot')
  mode = 'success'
  await say('我叫西瓜。')
  check(requests[1].history.length === 2 && requests[1].history[0].role === 'user', 'second turn sends the prior conversation')
  checkState(2, 0, 'second success increments only Kai')
  check(requests[1].npcState.familiarity === 1 && requests[1].npcState.hasMetPlayer === true, 'second Kai request uses recognized pre-turn state')
  await click('.npc-mira')
  check(spoken() === '你看起来也没怎么睡。', 'Mira panel opens normally')
  checkState(2, 0, 'switching to Mira preserves Kai and leaves Mira unmet')
  await say('论文怎么样？')
  check(requests[2].npc === 'mira' && requests[2].history.length === 0, 'Mira does not receive Kai history')
  checkState(2, 1, 'Mira first success updates only Mira')
  check(requests[2].npcState.familiarity === 0 && requests[2].npcState.deadlineStress === 'high', 'Mira sends her own stranger state independently')
  mode = 'error'
  await say('还要多久？')
  check(Boolean(container.querySelector('[role="alert"]')) && container.querySelector('input').value === '还要多久？', 'failure preserves draft and shows retry feedback')
  check(spoken() === 'mira: 论文怎么样？', 'failure preserves the last reply')
  checkState(2, 1, 'API failure does not update encounter or familiarity')
  mode = 'success'
  await submit()
  check(requests[3].history.length === 2 && requests[4].history.length === 2, 'retry does not include a failed turn')
  checkState(2, 2, 'successful retry increments once')
  check(requests[3].npcState.familiarity === 1 && requests[4].npcState.familiarity === 1, 'failed turn and retry use the same pre-turn state')
  await click('.npc-kai')
  check(spoken() === 'kai: 我叫西瓜。', 'returning to Kai preserves his conversation')
  checkState(2, 2, 'switching back preserves both states')
  mode = 'deferred'
  await say('取消这句')
  await click('.npc-mira')
  await act(async () => pending())
  check(spoken() === 'mira: 还要多久？', 'cancelled response cannot cross NPCs')
  checkState(2, 2, 'cancelled response cannot update either NPC')
  await click('.close-dialogue')
  check(!container.querySelector('.dialogue'), 'DialoguePanel closes')
  checkState(2, 2, 'closing does not change state')
  await click('.npc-kai')
  check(spoken() === 'kai: 我叫西瓜。', 'closing preserves successful history and excludes cancelled turns')
  for (const failureMode of ['rejected', 'invalid', 'timeout']) {
    mode = failureMode
    await say('这句失败')
    if (mode === 'timeout') await act(async () => expireRequest())
    checkState(2, 2, `${failureMode} does not update state`)
  }
  // A late response may already be buffered when cancellation fires.
  mode = 'deferred'
  await say('超时后才到达')
  await act(async () => { expireRequest(); pending() })
  checkState(2, 2, 'late reply after timeout cannot complete a turn')
  check(spoken() === 'kai: 我叫西瓜。' && Boolean(container.querySelector('[role="alert"]')), 'late timed-out reply preserves history and uses existing error UI')
  const beforeInvalid = requests.length
  await say('x'.repeat(1001))
  check(requests.length === beforeInvalid, 'oversize input never calls API')
  checkState(2, 2, 'frontend validation does not update state')
  mode = 'success'
  for (let index = 0; index < 10; index++) await say(`第 ${index} 句`)
  checkState(5, 2, 'familiarity caps at 5 without changing mood, trust or deadline stress')
  check(requests.at(-1).history.length === 20, 'history remains capped at 20 messages')
  check(requests.filter(request => request.message.startsWith('第 ')).slice(0, 4).map(request => request.npcState.familiarity).join(',') === '2,3,4,5', 'Kai requests enter familiar tier only on the next turn')
  await click('.npc-mira')
  await say('再聊一会儿')
  check(requests.at(-1).npcState.familiarity === 2, 'Mira stays recognized for the turn that raises her to familiar')
  await say('接着刚才的话')
  check(requests.at(-1).npcState.familiarity === 3, 'Mira next request independently uses familiar state')
  checkState(5, 4, 'familiar dialogue keeps both NPC states isolated')
  check(requests.every(request => Object.keys(request).sort().join(',') === 'history,message,npc,npcState'), 'requests contain only npc, message, history and current npcState')
  check(requests.every((request, index) => JSON.stringify(request.npcState) === JSON.stringify(preRequestStates[index])), 'every request uses its own pre-turn state snapshot')
  check(requests.every(request => Object.keys(request.npcState).sort().join(',') === Object.keys(createInitialNpcState()[request.npc]).sort().join(',')), 'Kai requests never carry Mira state or a combined state map')
  check(requests.every(request => request.history.every(entry => (entry.role === 'user' || entry.role === 'assistant') && Object.keys(entry).sort().join(',') === 'content,role')), 'history never contains system messages or state context')
  check(!/trust|familiarity|deadlineStress|hasMetPlayer|exhausted|neutral/.test(container.textContent), 'game has no runtime debug UI')
  check(!/behind_counter|making_coffee|checking_phone|grooming|currentActivity/.test(container.textContent), 'ambient activities have no visible debug labels')
  const requestsBeforeCat = requests.length
  await click('.npc-cat')
  check(container.querySelector('.cat-feedback').textContent.includes('没什么意思'), 'Cat keeps local feedback')
  checkState(5, 4, 'Cat does not change NPC state')
  check(requests.length === requestsBeforeCat, 'moving Cat interaction remains local-only')
  await act(async () => root.render(<App key="new-page-session" onNpcStateChange={observeState} />))
  check([...container.querySelectorAll('.npc')].map(node => node.dataset.activity).join(',') === 'behind_counter,reading_notes,sleeping' && intervalClock.timers.size === 3, 'App remount resets all activities and replaces old timers')
  checkState(0, 0, 'new App lifetime resets encounter and familiarity')
  await click('.npc-kai')
  await say('新一轮')
  check(requests.at(-1).history.length === 0, 'new page lifetime clears conversation history')
  checkState(1, 0, 'first success in a new session starts at familiarity 1')
  output.dataset.result = 'passed'
  output.textContent = JSON.stringify({ passed: checks.length, checks }, null, 2)
} catch (error) {
  output.dataset.result = 'failed'
  output.textContent = JSON.stringify({ passed: checks.length, error: error.message, checks }, null, 2)
} finally {
  await act(async () => root.unmount())
  intervalClock.restore()
  window.fetch = originalFetch
  window.setTimeout = originalSetTimeout
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
}
