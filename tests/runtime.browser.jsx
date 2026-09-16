// Standalone test page only; never imported by the game or production build.
import React, { act, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { useNpcStates } from '../src/hooks/useNpcStates.js'
import { createInitialNpcState } from '../src/data/npcState.js'
import '../src/styles.css'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const output = document.getElementById('results')
const container = document.getElementById('test-root')
const root = createRoot(container)
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
  await act(async () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })
    container.querySelector('input').dispatchEvent(event)
    check(event.defaultPrevented, 'IME confirmation Enter does not submit')
  })
  mode = 'deferred'
  await submit()
  await submit()
  check(requests.length === 1 && container.querySelector('[aria-label="发送"]').disabled, 'loading prevents duplicate requests')
  checkState(0, 0, 'pending and duplicate submission do not update state')
  await act(async () => pending())
  check(spoken() === 'kai: 今晚忙吗？', 'mock reply is displayed')
  checkState(1, 0, 'first successful reply marks Kai met and increments once')
  mode = 'success'
  await say('我叫西瓜。')
  check(requests[1].history.length === 2 && requests[1].history[0].role === 'user', 'second turn sends the prior conversation')
  checkState(2, 0, 'second success increments only Kai')
  await click('.npc-mira')
  check(spoken() === '你看起来也没怎么睡。', 'Mira panel opens normally')
  checkState(2, 0, 'switching to Mira preserves Kai and leaves Mira unmet')
  await say('论文怎么样？')
  check(requests[2].npc === 'mira' && requests[2].history.length === 0, 'Mira does not receive Kai history')
  checkState(2, 1, 'Mira first success updates only Mira')
  mode = 'error'
  await say('还要多久？')
  check(Boolean(container.querySelector('[role="alert"]')) && container.querySelector('input').value === '还要多久？', 'failure preserves draft and shows retry feedback')
  check(spoken() === 'mira: 论文怎么样？', 'failure preserves the last reply')
  checkState(2, 1, 'API failure does not update encounter or familiarity')
  mode = 'success'
  await submit()
  check(requests[3].history.length === 2 && requests[4].history.length === 2, 'retry does not include a failed turn')
  checkState(2, 2, 'successful retry increments once')
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
  check(requests.every(request => Object.keys(request).sort().join(',') === 'history,message,npc'), 'requests contain only npc, message and history')
  check(!/trust|familiarity|deadlineStress|hasMetPlayer|exhausted|neutral/.test(container.textContent), 'game has no runtime debug UI')
  await click('.npc-cat')
  check(container.querySelector('.cat-feedback').textContent.includes('没什么意思'), 'Cat keeps local feedback')
  checkState(5, 2, 'Cat does not change NPC state')
  await act(async () => root.render(<App key="new-page-session" onNpcStateChange={observeState} />))
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
  window.fetch = originalFetch
  window.setTimeout = originalSetTimeout
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
}
