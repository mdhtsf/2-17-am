import React, { act, StrictMode, useState } from 'react'
import App from '../src/App.jsx'
import { useSoundscape } from '../src/hooks/useSoundscape.js'

export async function verifyWorldEvents(root, container, check) {
  const originalSet = window.setTimeout, originalClear = window.clearTimeout, originalNow = Date.now
  const originalFetch = window.fetch, originalRandom = Math.random
  let time = 1000, serial = 0, failed = false
  const jobs = new Map(), requests = [], audioStates = []
  const audio = event => audioStates.push(event.detail)
  window.addEventListener('world-audio-debug', audio)
  Math.random = () => 0
  Date.now = () => time
  window.setTimeout = (fn, delay, ...args) => {
    if (![45000, 90000, 30000, 2500].includes(delay)) return originalSet(fn, delay, ...args)
    jobs.set(--serial, { fn, at: time + delay }); return serial
  }
  window.clearTimeout = id => { if (!jobs.delete(id)) originalClear(id) }
  const tick = async ms => {
    time += ms
    for (const [id, job] of [...jobs]) if (job.at <= time) { jobs.delete(id); await act(async () => job.fn()) }
  }
  window.fetch = async (url, options) => {
    if (url !== '/api/chat') throw new Error('Unexpected world test API')
    requests.push(JSON.parse(options.body))
    return failed ? Response.json({ error: 'test' }, { status: 502 }) : Response.json({ reply: '听见了。' })
  }
  const trigger = id => act(async () => window.dispatchEvent(new CustomEvent('world-event-trigger', { detail: { id } })))
  const say = text => act(async () => {
    const input = container.querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  try {
    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    check(Boolean(container.querySelector('[data-sound-toggle]')), 'Stage 5 minimal mute control exists')
    check(getComputedStyle(container.querySelector('[data-sound-toggle]')).pointerEvents === 'auto', 'sound control accepts physical clicks despite decorative HUD')
    check(audioStates.at(-1)?.status === 'locked', 'Strict Mode starts audio locked, without autoplay')
    await act(async () => container.querySelector('.npc-kai').click())
    check(audioStates.at(-1)?.status === 'locked', 'synthetic NPC click cannot unlock audio')
    await trigger('rain_intensifies')
    check(!container.querySelector('.ambient-speech'), 'player-locked Kai does not bark over dialogue')
    await say('听见了吗？'); await act(async () => container.querySelector('form').requestSubmit())
    check(requests.at(-1).recentWorldEvent === 'rain_intensifies', 'player sends semantic recent event')
    check(Object.keys(requests.at(-1)).sort().join(',') === 'activity,history,message,npc,recentWorldEvent', 'request excludes rendering and arbitrary event prose')
    failed = true; await say('再说一句'); await act(async () => container.querySelector('form').requestSubmit())
    check(Boolean(container.querySelector('.dialogue-error')), 'existing retry UI survives event context')
    await tick(30000)
    failed = false; await act(async () => container.querySelector('form').requestSubmit())
    check(!Object.hasOwn(requests.at(-1), 'recentWorldEvent'), 'retry after event expiry does not send stale context')
    check(container.querySelector('.spoken').textContent === '听见了。', 'reply displays after event expiry')
    await act(async () => container.querySelector('.close-dialogue').click())
    // Fresh scene puts Kai at the counter and frees all reservations.
    await act(async () => root.render(null))
    await act(async () => root.render(<App />))
    await trigger('door_noise')
    check(container.querySelector('.ambient-speech')?.textContent.length > 0, 'counter event displays a single scene bark')
    check(container.querySelectorAll('.ambient-speech').length === 1, 'world event never creates multiple speaker bubbles')
    await tick(2500); check(!container.querySelector('.ambient-speech'), 'world bark expires without player action')
    await trigger('door_noise')
    await act(async () => container.querySelector('.npc-kai').click())
    check(!container.querySelector('.ambient-speech'), 'player interaction clears current world bark')
    await tick(2500); check(Boolean(container.querySelector('.dialogue')), 'late bark cleanup does not close player dialogue')
    await trigger('quiet_lull'); check(!container.querySelector('.ambient-speech'), 'quiet lull remains silent')
    await verifyRepeatedAudio(root, container, check)
  } finally {
    await act(async () => root.render(null))
    window.setTimeout = originalSet; window.clearTimeout = originalClear; Date.now = originalNow
    window.fetch = originalFetch; Math.random = originalRandom
    window.removeEventListener('world-audio-debug', audio)
  }
}


async function verifyRepeatedAudio(root, container, check) {
  await act(async () => root.render(null))
  const OriginalContext = window.AudioContext
  const savedFetch = window.fetch
  window.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  let oscillators = 0, ended = null
  const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v }, linearRampToValueAtTime(v) { this.value = v } })
  const node = () => ({ gain: param(), frequency: param(), connect() {}, disconnect() {}, start() {}, stop() {} })
  window.AudioContext = class {
    currentTime = 0; sampleRate = 100; state = 'running'; destination = {}
    resume() { return Promise.resolve() }
    close() { this.state = 'closed'; return Promise.resolve() }
    decodeAudioData() { return Promise.resolve({ duration: 30 }) }
    createGain() { return node() }
    createBiquadFilter() { return node() }
    createBufferSource() { return node() }
    createOscillator() { oscillators++; const n = node(); ended = () => n.onended?.(); return n }
    createBuffer(_, size) { return { getChannelData: () => new Float32Array(size) } }
  }
  function Harness() {
    const [event, setEvent] = useState(null)
    const sound = useSoundscape(event?.id, event?.sequence)
    return <><button id="unlock-fixture" onClick={() => sound.toggleMuted({ nativeEvent: { isTrusted: true } })}>Test audio boundary</button>
      <button id="door-fixture" onClick={() => setEvent(old => ({ id: 'door_noise', sequence: (old?.sequence || 0) + 1 }))}>Door</button></>
  }
  try {
    await act(async () => root.render(<Harness />))
    await act(async () => container.querySelector('#unlock-fixture').click())
    await act(async () => container.querySelector('#unlock-fixture').click())
    check(oscillators === 0, 'recorded rain has no continuous oscillator')
    await act(async () => container.querySelector('#door-fixture').click())
    check(oscillators === 1, 'sound hook plays the first manual door event')
    ended()
    await act(async () => container.querySelector('#door-fixture').click())
    check(oscillators === 2, 'same-ID manual event with a new sequence plays again')
  } finally {
    await act(async () => root.render(null))
    window.AudioContext = OriginalContext
    window.fetch = savedFetch
  }
}
