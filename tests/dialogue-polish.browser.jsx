import React, { act, useState } from 'react'
import DialoguePanel from '../src/components/DialoguePanel.jsx'
import { npcs } from '../shared/npcs.js'

// The transport deliberately ignores abort. This catches stale responses that
// arrive from an already-buffered body as well as providers that settle late.
export async function verifyDialoguePolish(root, container, check) {
  const originalFetch = window.fetch
  const originalSetTimeout = window.setTimeout
  const originalClearTimeout = window.clearTimeout
  const originalRandom = Math.random
  const timers = new Map(), requests = [], completed = []
  let time = 0, nextTimer = -1
  window.setTimeout = (callback, delay, ...args) => {
    if (delay !== 8000 && delay !== 60000) return originalSetTimeout(callback, delay, ...args)
    const id = nextTimer--
    timers.set(id, { at: time + delay, callback: () => callback(...args) })
    return id
  }
  window.clearTimeout = id => timers.delete(id) || originalClearTimeout(id)
  window.fetch = (url, options) => {
    if (url !== '/api/chat') throw new Error('Unexpected dialogue polish request')
    return new Promise(resolve => requests.push({ body: JSON.parse(options.body), signal: options.signal,
      reply: text => resolve(Response.json({ reply: text })) }))
  }
  function Fixture({ npcId }) {
    const [history, setHistory] = useState([{ role: 'user', content: '刚才的话' }, { role: 'assistant', content: '听见了。' }])
    return <DialoguePanel character={npcs[npcId]} history={history} onClose={() => {}}
      onComplete={(id, text, reply) => {
        completed.push({ id, text, reply })
        setHistory(previous => [...previous, { role: 'user', content: text }, { role: 'assistant', content: reply }])
      }} />
  }
  const spoken = () => container.querySelector('.spoken').textContent
  const sending = () => container.querySelector('[aria-label="发送"]').disabled
  const fill = text => act(async () => {
    const input = container.querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const submit = () => act(async () => container.querySelector('form').requestSubmit())
  const advance = milliseconds => act(async () => {
    time += milliseconds
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback() }
  })
  try {
    Math.random = () => 0
    await act(async () => root.render(<Fixture npcId="kai" />))
    await fill('今晚还要忙多久？'); await submit(); await submit()
    check(requests.length === 1 && sending(), 'dialogue polish: pending request remains locked against duplicate Enter')
    await advance(7999)
    check(sending() && !requests[0].signal.aborted, 'dialogue polish: wait remains active before the eight-second deadline')
    await advance(1)
    const kaiFallback = spoken()
    check(!sending() && requests[0].signal.aborted, 'dialogue polish: eight seconds releases loading even when fetch ignores abort')
    check(kaiFallback !== '听见了。' && kaiFallback.length < 50 && !/API|JSON|429|timeout|OpenRouter|provider/i.test(kaiFallback),
      'dialogue polish: deadline shows short in-world Kai speech instead of technical errors')
    check(!container.querySelector('[role="alert"]') && container.querySelector('input').value === '今晚还要忙多久？' && completed.length === 0,
      'dialogue polish: timeout keeps the retry draft without appending fallback or failed turn to history')
    await submit()
    check(requests.length === 2 && requests[1].body.history.length === 2 && sending(), 'dialogue polish: retry starts with only successful history')
    await act(async () => requests[0].reply('这句已经过时'))
    check(spoken() === kaiFallback && sending(), 'dialogue polish: stale resolution cannot replace fallback or unlock a newer pending request')
    await act(async () => requests[1].reply('这次听见了。'))
    check(spoken() === '这次听见了。' && container.querySelector('input').value === '' && completed.length === 1 && timers.size === 0,
      'dialogue polish: successful retry replaces fallback and clears its deadline')

    await fill('稍后才回来'); await submit(); await advance(8000)
    await fill('换个问题'); await submit()
    check(requests.at(-1).body.history.length === 4, 'dialogue polish: a new message also excludes the previous expired turn')
    await act(async () => requests[3].reply('新问题的回答。'))
    await act(async () => requests[2].reply('迟到的旧问题回答。'))
    check(spoken() === '新问题的回答。' && completed.length === 2, 'dialogue polish: late old reply cannot overwrite a newer successful conversation')

    const variants = new Set([kaiFallback])
    for (const randomValue of [0.4, 0.99]) {
      Math.random = () => randomValue
      await fill('你听见了吗'); await submit(); await advance(8000)
      variants.add(spoken())
    }
    check(variants.size >= 3, 'dialogue polish: Kai timeout has a small varied fallback pool')
    await fill('切换前未完成'); await submit()
    const abandoned = requests.at(-1)
    await act(async () => root.render(<Fixture npcId="mira" key="mira" />))
    check(abandoned.signal.aborted && timers.size === 0, 'dialogue polish: switching NPC cleans up the active deadline and request')
    await act(async () => abandoned.reply('不应写给米拉'))
    check(spoken() === '听见了。', 'dialogue polish: a closed Kai request cannot appear in Mira dialogue')
    const miraVariants = new Set()
    for (const randomValue of [0, 0.4, 0.99]) {
      Math.random = () => randomValue
      await fill('我刚才说什么'); await submit(); await advance(8000)
      miraVariants.add(spoken())
    }
    check(miraVariants.size >= 3 && [...miraVariants].every(line => !variants.has(line) && line.length < 70),
      'dialogue polish: Mira uses her own concise fallback pool')
    await fill('关闭前未完成'); await submit()
    const closed = requests.at(-1)
    await act(async () => root.render(null))
    check(closed.signal.aborted && timers.size === 0, 'dialogue polish: closing the panel cleans up every active timer')
    await act(async () => closed.reply('已关闭'))
    check(!container.querySelector('.dialogue') && completed.length === 2, 'dialogue polish: closed requests cannot append successful history')
  } finally {
    await act(async () => root.render(null))
    window.fetch = originalFetch
    window.setTimeout = originalSetTimeout
    window.clearTimeout = originalClearTimeout
    Math.random = originalRandom
  }
}
