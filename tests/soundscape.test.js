import test from 'node:test'
import assert from 'node:assert/strict'
import { createSoundscape } from '../src/audio/soundscape.js'

function audioFixture(resume = async () => {}, fetchAudio = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) {
  const nodes = [], states = []
  let closed = 0, created = 0
  const param = () => ({ value: 0, ramps: [], cancelScheduledValues() {}, setValueAtTime(value) { this.value = value },
    linearRampToValueAtTime(value, time) { this.value = value; this.ramps.push({ value, time }) } })
  function node(kind) {
    const n = { kind, gain: param(), frequency: param(), Q: param(), connections: [], stops: 0,
      connect(to) { this.connections.push(to) }, disconnect() { this.connections = [] },
      start() {}, stop() { this.stops++ } }
    nodes.push(n); return n
  }
  const context = { currentTime: 0, sampleRate: 100, state: 'running', destination: {}, resume,
    decodeAudioData: async () => ({ duration: 28 }), createGain: () => node('gain'), createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('buffer'), createOscillator: () => node('oscillator'),
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    close: async () => { closed++; context.state = 'closed' },
  }
  const sound = createSoundscape({ createContext: () => { created++; return context }, fetchAudio, onState: state => states.push(state) })
  return { sound, nodes, states, context, created: () => created, closed: () => closed }
}

test('audio stays locked before user gesture and handles unsupported contexts', async () => {
  let calls = 0
  const states = []
  const sound = createSoundscape({ createContext: () => { calls++; throw new Error('unsupported') }, onState: s => states.push(s) })
  sound.applyEvent('door_noise'); sound.setMuted(true)
  assert.equal(calls, 0)
  await sound.unlock(); assert.equal(states.at(-1).status, 'unavailable')
  sound.dispose()
})
test('unlock fades loops in once; mute and unmute update master gain', async () => {
  const f = audioFixture()
  f.sound.applyEvent('door_noise'); assert.equal(f.created(), 0)
  await f.sound.unlock(); await f.sound.unlock()
  assert.equal(f.created(), 1)
  const gains = f.nodes.filter(n => n.kind === 'gain')
  const master = gains[0]
  assert.equal(master.gain.ramps.at(-1).time, 2)
  assert.equal(master.gain.value, 0.65)
  assert.equal(f.nodes.filter(n => n.kind === 'oscillator').length, 0, 'no historical door replay')
  f.sound.setMuted(true); assert.equal(master.gain.value, 0)
  assert.equal(f.states.at(-1).status, 'muted')
  const before = f.nodes.length
  f.sound.applyEvent('door_noise'); assert.equal(f.nodes.length, before)
  f.sound.setMuted(false); assert.equal(master.gain.value, 0.65)
  f.sound.dispose(); assert.equal(f.closed(), 1)
  assert.ok(f.nodes.every(n => n.connections.length === 0))
})
test('recorded rain loops with absolute weather levels and no indoor source', async () => {
  const f = audioFixture(); await f.sound.unlock()
  const [master, rain] = f.nodes.filter(n => n.kind === 'gain')
  assert.equal(f.nodes.filter(n => n.kind === 'buffer').length, 1)
  assert.equal(f.nodes.find(n => n.kind === 'buffer').loop, true)
  assert.equal(f.nodes.filter(n => n.kind === 'oscillator').length, 0)
  f.sound.applyEvent('rain_intensifies'); assert.equal(rain.gain.value, 0.7)
  f.sound.applyEvent('rain_intensifies'); assert.equal(rain.gain.value, 0.7)
  f.sound.setMuted(true); f.sound.applyEvent('rain_softens'); f.sound.setMuted(false)
  assert.equal(master.gain.value, 0.65); assert.equal(rain.gain.value, 0.22)
  assert.equal(f.states.at(-1).rainState, 'softened')
  f.sound.applyEvent('quiet_lull'); assert.equal(rain.gain.value, 0.4)
  assert.equal(rain.gain.ramps.at(-1).time, 3)
  assert.equal(f.states.at(-1).rainState, 'baseline'); f.sound.dispose()
})
test('door is single flight, respects suspension and mute, and is never replayed', async () => {
  const f = audioFixture(); await f.sound.unlock()
  f.sound.applyEvent('door_noise'); f.sound.applyEvent('door_noise')
  assert.equal(f.nodes.filter(n => n.kind === 'oscillator').length, 1)
  f.nodes.find(n => n.kind === 'oscillator').onended()
  f.sound.applyEvent('door_noise')
  assert.equal(f.nodes.filter(n => n.kind === 'oscillator').length, 2)
  f.sound.setMuted(true); f.sound.applyEvent('door_noise'); f.sound.setMuted(false)
  f.context.state = 'suspended'; f.sound.applyEvent('door_noise')
  assert.equal(f.nodes.filter(n => n.kind === 'oscillator').length, 2); f.sound.dispose()
})
test('HTTP and decode failures are contained and release resources', async () => {
  for (const kind of ['http', 'decode']) {
    const f = audioFixture(undefined, async () => ({ ok: kind !== 'http', arrayBuffer: async () => new ArrayBuffer(8) }))
    if (kind === 'decode') f.context.decodeAudioData = async () => { throw Error('invalid audio') }
    await f.sound.unlock(); assert.equal(f.states.at(-1).status, 'unavailable')
    assert.equal(f.closed(), 1); assert.equal(f.nodes.length, 0); f.sound.dispose()
  }
})
test('dispose aborts pending download and late decode cannot build a graph', async () => {
  let resolve, signal
  const f = audioFixture(undefined, async (_, options) => {
    signal = options.signal
    return { ok: true, arrayBuffer: () => new Promise(r => { resolve = r }) }
  })
  const pending = f.sound.unlock()
  await new Promise(r => setImmediate(r))
  f.sound.dispose(); assert.equal(signal.aborted, true)
  resolve(new ArrayBuffer(8)); await pending; assert.equal(f.nodes.length, 0)
})
test('late resume cannot play after disposal or override a mute during unlock', async () => {
  let resolve
  const f = audioFixture(() => new Promise(r => { resolve = r }))
  const pending = f.sound.unlock(); f.sound.dispose(); resolve(); await pending
  assert.equal(f.nodes.length, 0)
  assert.equal(f.closed(), 1)
  let ready
  const g = audioFixture(() => new Promise(r => { ready = r }))
  const waiting = g.sound.unlock(); g.sound.setMuted(true); ready(); await waiting
  assert.equal(g.nodes.find(n => n.kind === 'gain').gain.value, 0)
  assert.equal(g.states.at(-1).status, 'muted'); g.sound.dispose()
})
test('resume failure is contained and partially created resources are closed', async () => {
  const f = audioFixture(async () => { throw new Error('not allowed') })
  await f.sound.unlock()
  assert.equal(f.states.at(-1).status, 'unavailable')
  assert.equal(f.closed(), 1)
  f.sound.dispose(); assert.equal(f.closed(), 1)
})

test('trusted unlock resumes an interrupted context without creating duplicate loops', async () => {
  let resumes = 0
  const f = audioFixture(async () => { resumes++; f.context.state = 'running' })
  await f.sound.unlock()
  const initialNodes = f.nodes.length
  f.context.state = 'suspended'; f.context.onstatechange?.()
  assert.equal(f.states.at(-1).status, 'locked', 'suspension must not falsely report audible playback')
  await f.sound.unlock()
  assert.equal(resumes, 2)
  assert.equal(f.created(), 1)
  assert.equal(f.nodes.length, initialNodes)
  assert.equal(f.states.at(-1).status, 'running')
  f.sound.dispose()
})

test('download deadline fails safely rather than leaving an active loading request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = audioFixture(undefined, (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }))
  const pending = f.sound.unlock()
  await Promise.resolve()
  t.mock.timers.tick(15000)
  await pending
  assert.equal(f.states.at(-1).status, 'unavailable')
  assert.equal(f.closed(), 1)
  f.sound.dispose()
})
