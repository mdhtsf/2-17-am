import React, { act, StrictMode } from 'react'
import App from '../src/App.jsx'

export async function verifyCounterSocial(root, container, check, clock) {
  const originalSet = window.setTimeout, originalClear = window.clearTimeout
  const originalFetch = window.fetch
  let requests = 0
  let releaseGrace
  const debug = []
  const onDebug = event => debug.push(event.detail)
  window.addEventListener('counter-social-debug', onDebug)
  let interruptedSignal
  window.fetch = async (url, options) => {
    requests++
    check(url === '/api/social-chat', 'social generation uses its dedicated endpoint')
    const context = JSON.parse(options.body)
    check(Object.keys(context).sort().join(',') === 'kaiActivity,miraActivity,miraPreviousActivity,recentExchanges', 'only semantic activity context is sent')
    if (requests === 3) return new Promise(resolve => { releaseGrace = () => resolve(Response.json({ lines: [{ speaker: 'kai', text: '冰箱比人精神。' }, { speaker: 'mira', text: '它没有论文。' }] })) })
    if (requests === 2 || requests === 4) {
      interruptedSignal = options.signal
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }))
    }
    return Response.json({ lines: [
      { speaker: 'mira', text: '光标又停住了。' }, { speaker: 'kai', text: '它也值夜班。' }, { speaker: 'mira', text: '那让它歇会儿。' },
    ] })
  }
  const timers = new Map()
  let serial = -800000
  window.setTimeout = (fn, ms, ...args) => {
    if (![90000, 2200, 50000].includes(ms)) return originalSet(fn, ms, ...args)
    timers.set(--serial, { fn, ms }); return serial
  }
  window.clearTimeout = id => { if (!timers.delete(id)) originalClear(id) }
  const fire = async ms => {
    const entry = [...timers].find(([, timer]) => timer.ms === ms)
    check(Boolean(entry), `social ${ms}ms timer exists`)
    timers.delete(entry[0])
    await act(async () => entry[1].fn())
  }
  const finish = async entity => {
    for (let i = 0; i < 40 && entity.querySelector('.walking-visual').dataset.phase !== 'idle'; i++) {
      await act(async () => {
        entity.getAnimations().forEach(animation => animation.finish())
        await new Promise(resolve => originalSet(resolve, 40))
      })
    }
    check(entity.querySelector('.walking-visual').dataset.phase === 'idle', 'social route reaches idle')
  }
  try {
    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    check([...timers.values()].filter(t => t.ms === 90000).length === 1, 'Strict Mode keeps one rare opportunity timer')
    const kai = container.querySelector('.npc-kai'), mira = container.querySelector('.npc-mira')
    const kaiStart = kai.getAttribute('style')
    await fire(90000)
    check(mira.dataset.activity === 'talking_to_kai' && clock.timers.size === 0, 'social approach reserves the normal major-event gate')
    check(!container.querySelector('.ambient-speech') && requests === 1, 'generation starts during approach without premature speech')
    await finish(mira)
    check(mira.dataset.location === 'counter_chat', 'Mira reaches the reused counter opening')
    check(container.querySelector('.ambient-speech')?.textContent === '光标又停住了。', 'validated generated exchange replaces curated fallback')
    const speakers = []
    for (let i = 0; i < 3; i++) {
      const bubble = container.querySelector('.ambient-speech')
      const entity = bubble?.closest('.npc')
      speakers.push(entity?.classList.contains('npc-mira') ? 'mira' : 'kai')
      check(container.querySelectorAll('.ambient-speech').length === 1 && entity?.contains(bubble), 'one overheard line is attached to the actual speaker')
      const face = entity.getBoundingClientRect(), box = bubble.getBoundingClientRect()
      check(Math.abs(box.left + box.width / 2 - face.left - face.width / 2) < 1 && box.bottom < face.top,
        'speech bubble follows the speaker center and sits above its visual')
      check(!container.querySelector('.dialogue'), 'ambient speech does not open the player DialoguePanel')
      check(kai.getAttribute('style') === kaiStart && kai.dataset.activity === 'behind_counter', 'Kai stays behind the counter for every line')
      await fire(2200)
    }
    check(speakers.join(',') === 'mira,kai,mira' && !container.querySelector('.ambient-speech'), 'exchange alternates and self-cleans')
    await finish(mira)
    check(mira.dataset.activity === 'reading_notes' && clock.timers.size === 1, 'Mira returns to prior activity and normal ambient scheduling resumes')
    await fire(90000)
    await act(async () => mira.click())
    await finish(mira)
    check(!container.querySelector('.ambient-speech') && mira.dataset.activity === 'talking_to_kai', 'player interruption clears speech and defers departure during Mira interaction')
    check(container.querySelector('h2').textContent === 'MIRA', 'player dialogue and portrait remain usable during interruption')
    await act(async () => container.querySelector('.close-dialogue').click())
    await finish(mira)
    check(mira.dataset.activity === 'reading_notes' && clock.timers.size === 1, 'closing player interaction releases deferred social cleanup')
    check(requests === 2 && interruptedSignal?.aborted, 'one request per event; player interruption cancels in-flight generation')
    await fire(90000)
    await finish(mira)
    check(!container.querySelector('.ambient-speech') && [...timers.values()].some(t => t.ms === 50000), 'pending reply receives its original request deadline after arrival')
    await act(async () => releaseGrace())
    check(container.querySelector('.ambient-speech')?.textContent === '冰箱比人精神。', 'reply arriving after arrival plays without fallback')
    check(debug.at(-1).source === 'llm', 'dev diagnostic reports actual LLM playback')
    await fire(2200); await fire(2200); await finish(mira)
    await fire(90000); await finish(mira)
    check(!container.querySelector('.ambient-speech'), 'timeout event is initially silent at counter')
    await fire(50000)
    check(debug.at(-1).source === 'fallback' && debug.at(-1).reason === 'timeout', 'dev diagnostic distinguishes timeout fallback')
    check(Boolean(container.querySelector('.ambient-speech')), 'timeout uses curated speech instead of waiting indefinitely')
    await act(async () => kai.click())
    check(!container.querySelector('.ambient-speech'), 'player interruption clears timeout fallback too')
    await act(async () => root.render(null))
    check(timers.size === 0 && !container.querySelector('.ambient-speech'), 'unmount removes social timers and bubbles')
  } finally { window.removeEventListener('counter-social-debug', onDebug); window.setTimeout = originalSet; window.clearTimeout = originalClear; window.fetch = originalFetch }
}
