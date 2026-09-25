// Recording and gain calibration are documented in public/assets/audio/README.md.
export const RAIN_ASSET = '/assets/audio/rain-loop.mp3'
export const LEVELS = Object.freeze({ master: 0.65, softened: 0.22, baseline: 0.4, intensified: 0.7, door: 0.16 })
export function createSoundscape({ createContext, onState = () => {}, fetchAudio = (...args) => fetch(...args) }) {
  let context = null, graph = null, pending = null, disposed = false, unavailable = false, muted = false
  const download = new AbortController()
  let loadTimer
  let doorActive = false
  let currentEvent
  const rainState = () => currentEvent === 'rain_intensifies' ? 'intensified' : currentEvent === 'rain_softens' ? 'softened' : 'baseline'
  const nodes = new Set(), sources = new Set()
  const publish = () => { if (!disposed) onState({ status: unavailable ? 'unavailable' : graph && context?.state === 'running' ? (muted ? 'muted' : 'running') : 'locked', muted, rainState: rainState() }) }
  function ramp(param, value, seconds) {
    const time = context.currentTime
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time)
    else { param.cancelScheduledValues(time); param.setValueAtTime(param.value, time) }
    param.linearRampToValueAtTime(value, time + seconds)
  }
  function keep(node) { nodes.add(node); return node }
  function source(node) { keep(node); sources.add(node); return node }
  function release() {
    clearTimeout(loadTimer)
    download.abort()
    doorActive = false
    for (const node of sources) { try { node.stop() } catch { /* already ended */ } }
    for (const node of nodes) node.disconnect()
    sources.clear(); nodes.clear(); graph = null
    const old = context; context = null
    if (old) old.onstatechange = null
    if (old && old.state !== 'closed') { try { Promise.resolve(old.close()).catch(() => {}) } catch { /* teardown only */ } }
  }
  function build(buffer) {
    const master = keep(context.createGain()), rain = keep(context.createGain())
    master.gain.value = 0; rain.gain.value = LEVELS[rainState()]
    master.connect(context.destination); rain.connect(master)
    const recording = source(context.createBufferSource())
    recording.buffer = buffer; recording.loop = true; recording.connect(rain)
    recording.start()
    graph = { master, rain }
  }
  function environment() {
    if (graph) ramp(graph.rain.gain, LEVELS[rainState()], 3)
  }
  function door() {
    if (doorActive) return
    doorActive = true
    const tone = source(context.createOscillator()), envelope = keep(context.createGain())
    const time = context.currentTime
    tone.type = 'sine'; tone.frequency.value = 720
    envelope.gain.value = 0; envelope.gain.setValueAtTime(0, time)
    envelope.gain.linearRampToValueAtTime(LEVELS.door, time + 0.04)
    envelope.gain.linearRampToValueAtTime(0, time + 0.65)
    tone.connect(envelope); envelope.connect(graph.master)
    tone.onended = () => { doorActive = false; tone.disconnect(); envelope.disconnect(); sources.delete(tone); nodes.delete(tone); nodes.delete(envelope) }
    tone.start(); tone.stop(time + 0.7)
  }
  return {
    unlock() {
      if (disposed || unavailable || (graph && context?.state === 'running')) return Promise.resolve()
      if (pending) return pending
      // Creation and resume are invoked in the original trusted gesture stack.
      try {
        if (!context) context = createContext()
        if (!context) throw new Error('Audio unavailable')
        context.onstatechange = publish
      }
      catch { unavailable = true; release(); publish(); return Promise.resolve() }
      let resumed
      try { resumed = context.resume() } catch (error) { resumed = Promise.reject(error) }
      pending = Promise.resolve(resumed).then(async () => {
        if (disposed) return
        if (!graph) {
          // Fetch/decode only after a gesture; failures never block the scene.
          loadTimer = setTimeout(() => download.abort(), 15000)
          try {
            const response = await fetchAudio(RAIN_ASSET, { signal: download.signal })
            if (!response.ok) throw new Error('Rain asset unavailable')
            const bytes = await response.arrayBuffer()
            if (disposed) return
            const buffer = await context.decodeAudioData(bytes)
            if (disposed) return
            if (download.signal.aborted) throw new Error('Rain load timed out')
            build(buffer)
          } finally { clearTimeout(loadTimer) }
        }
        environment(); ramp(graph.master.gain, muted ? 0 : LEVELS.master, 2); publish()
      }).catch(() => {
        if (disposed) return
        unavailable = true; release(); publish()
      }).finally(() => { pending = null })
      return pending
    },
    setMuted(value) {
      muted = Boolean(value)
      if (graph) ramp(graph.master.gain, muted ? 0 : LEVELS.master, 0.2)
      publish()
    },
    applyEvent(id) {
      currentEvent = id
      if (disposed) return
      environment(); publish()
      if (!graph || muted || context.state !== 'running') return
      if (id === 'door_noise') door()
    },
    dispose() { if (disposed) return; disposed = true; release() },
  }
}
