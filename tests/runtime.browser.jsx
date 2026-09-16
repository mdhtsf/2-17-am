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
const originalFetch = window.fetch
// No request can escape this fixture to a real model.
window.fetch = async (url, options) => {
  if (url !== '/api/chat') throw new Error('Unexpected test request')
  const body = JSON.parse(options.body)
  requests.push(body)
  const result = () => Response.json({ reply: `${body.npc}: ${body.message}` })
  if (mode === 'deferred') return new Promise(resolve => { pending = () => resolve(result()) })
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

  await act(async () => root.render(<App />))
  await click('.npc-kai')
  check(spoken() === '还没睡？', 'Kai panel opens normally')
  await fill('  ')
  check(container.querySelector('[aria-label="发送"]').disabled, 'empty input cannot send')
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
  mode = 'success'
  for (let index = 0; index < 10; index++) await say(`第 ${index} 句`)
  check(requests.at(-1).history.length === 20, 'history remains capped at 20 messages')
  check(requests.every(request => Object.keys(request).sort().join(',') === 'history,message,npc'), 'requests contain only npc, message and history')
  check(!/trust|familiarity|deadlineStress|hasMetPlayer|exhausted|neutral/.test(container.textContent), 'game has no runtime debug UI')
  await click('.npc-cat')
  check(container.querySelector('.cat-feedback').textContent.includes('没什么意思'), 'Cat keeps local feedback')
  await act(async () => root.render(<App key="new-page-session" />))
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
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
}
