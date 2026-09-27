import React, { act, StrictMode } from 'react'
import App from '../src/App.jsx'

export async function verifyCounterSocial(root, container, check, clock) {
  const originalSet = window.setTimeout, originalClear = window.clearTimeout
  const originalFetch = window.fetch, originalRandom = Math.random
  let presentationDraw = 0.7
  const presentationDraws = []
  Math.random = () => presentationDraws.length ? presentationDraws.shift() : originalRandom()
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
    if (requests === 2 || requests === 4 || requests === 6) {
      interruptedSignal = options.signal
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }))
    }
    if (requests === 5) return Response.json({ lines: [{ speaker: 'mira', text: '那本笔记先放这儿。' }, { speaker: 'kai', text: '好。' }] })
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
    if (ms === 90000) presentationDraws.push(presentationDraw)
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
    presentationDraws.push(presentationDraw)
    await act(async () => window.dispatchEvent(new Event('counter-social-trigger')))
    check([...timers.values()].filter(t => t.ms === 90000).length === 1, 'explicit preview trigger leaves one fresh social cooldown')
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
    await act(async () => container.querySelector('.close-dialogue').click())
    await finish(mira)
    presentationDraw = 0
    const remoteKaiStart = kai.getAttribute('style'), remoteMiraStart = mira.getAttribute('style')
    await fire(90000)
    check(mira.dataset.activity === 'reading_notes' && mira.dataset.location === 'notes_spot', 'remote social mode preserves Mira activity and location')
    check(kai.getAttribute('style') === remoteKaiStart && mira.getAttribute('style') === remoteMiraStart, 'remote speech makes no unnecessary NPC movement')
    check(clock.timers.size === 0 && debug.at(-1).presentation === 'remote', 'remote event holds the same reservation for both participants')
    check(debug.at(-1).source === 'llm' && container.querySelector('.ambient-speech')?.textContent === '那本笔记先放这儿。', 'remote mode uses the existing LLM pipeline and speaker bubbles')
    await fire(2200)
    check(container.querySelector('.ambient-speech')?.closest('.npc-kai'), 'remote response follows Kai at the counter')
    await fire(2200)
    check(!container.querySelector('.ambient-speech') && clock.timers.size === 1, 'remote exchange releases reservation without a return trip')
    check(kai.getAttribute('style') === remoteKaiStart && mira.getAttribute('style') === remoteMiraStart, 'remote cleanup preserves both positions')
    await fire(90000)
    check(!container.querySelector('.ambient-speech') && clock.timers.size === 0, 'remote pending generation remains quiet and reserved')
    await act(async () => mira.click())
    check(interruptedSignal?.aborted && !container.querySelector('.ambient-speech'), 'player interaction aborts remote generation immediately')
    check(mira.dataset.activity === 'reading_notes' && mira.getAttribute('style') === remoteMiraStart, 'remote interruption never assigns a social or restoration walk')
    await act(async () => container.querySelector('.close-dialogue').click())
    check(clock.timers.size === 1, 'ambient scheduling remains available after remote interaction ends')
    await act(async () => root.render(null))
    check(timers.size === 0 && !container.querySelector('.ambient-speech'), 'unmount removes social timers and bubbles')
    const requestsAfterStop = requests
    await act(async () => window.dispatchEvent(new Event('counter-social-trigger')))
    check(requests === requestsAfterStop && timers.size === 0, 'unmounted preview trigger cannot revive social work')
  } finally { window.removeEventListener('counter-social-debug', onDebug); window.setTimeout = originalSet; window.clearTimeout = originalClear; window.fetch = originalFetch; Math.random = originalRandom }
}
