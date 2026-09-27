import test from 'node:test'
import assert from 'node:assert/strict'
import { createSoundscape } from '../src/audio/soundscape.js'

function audioFixture(resume = async () => {}, fetchAudio = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), options = {}) {
  const nodes = [], states = []
  let closed = 0, created = 0
  const param = () => ({ value: 0, ramps: [], cancelScheduledValues() {}, setValueAtTime(value) { this.value = value },
    linearRampToValueAtTime(value, time) { this.value = value; this.ramps.push({ value, time }) } })
  function node(kind) {
    const n = { kind, gain: param(), frequency: param(), playbackRate: param(), Q: param(), connections: [], stops: 0,
      connect(to) { this.connections.push(to) }, disconnect() { this.connections = [] },
      start(...args) { this.started = args }, stop() { this.stops++ } }
    nodes.push(n); return n
  }
  const context = { currentTime: 0, sampleRate: 100, state: 'running', destination: {}, resume,
    decodeAudioData: async () => ({ duration: 28 }), createGain: () => node('gain'), createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('buffer'), createOscillator: () => node('oscillator'),
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    close: async () => { closed++; context.state = 'closed' },
  }
  const sound = createSoundscape({ createContext: () => { created++; return context }, fetchAudio, onState: state => states.push(state), ...options })
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
  f.sound.applyEvent('rain_intensifies'); assert.equal(rain.gain.value, 0.46)
  f.sound.applyEvent('rain_intensifies'); assert.equal(rain.gain.value, 0.46)
  f.sound.setMuted(true); f.sound.applyEvent('rain_softens'); f.sound.setMuted(false)
  assert.equal(master.gain.value, 0.65); assert.equal(rain.gain.value, 0.22)
  assert.equal(f.states.at(-1).rainState, 'softened')
  f.sound.applyEvent('quiet_lull'); assert.equal(rain.gain.value, 0.34)
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

function scheduledFixture(random = () => 0, fetchAudio) {
  let now = 0, nextId = 0
  const jobs = new Map()
  const options = {
    random,
    setTimer(callback, delay) { const id = ++nextId; jobs.set(id, { callback, delay, at: now + delay }); return id },
    clearTimer(id) { jobs.delete(id) },
  }
  const f = audioFixture(undefined, fetchAudio, options)
  return { ...f, jobs, advance(ms) {
    const target = now + ms
    for (;;) {
      const first = [...jobs].sort((a, b) => a[1].at - b[1].at)[0]
      if (!first || first[1].at > target) break
      now = first[1].at; jobs.delete(first[0]); first[1].callback()
    }
    now = target
  } }
}
const settleLoads = () => new Promise(resolve => setImmediate(resolve))
const oneShots = f => f.nodes.filter(n => n.kind === 'buffer' && !n.loop)

test('meow opportunities are randomized, probabilistic, and cannot stack', async () => {
  const f = scheduledFixture()
  await f.sound.unlock(); await settleLoads()
  assert.ok([...f.jobs.values()].some(job => job.delay === 20000))
  f.advance(19999)
  assert.equal(oneShots(f).filter(n => n.started.length === 1).length, 0)
  f.advance(1)
  const meows = oneShots(f).filter(n => n.started.length === 1)
  assert.equal(meows.length, 1, 'first opportunity may play a whole short meow recording')
  assert.equal(meows[0].loop, undefined)
  f.advance(20000)
  assert.equal(oneShots(f).filter(n => n.started.length === 1).length, 1, 'unfinished meow never stacks')
  meows[0].onended()
  f.advance(20000)
  assert.equal(oneShots(f).filter(n => n.started.length === 1).length, 2)
  f.sound.dispose(); assert.equal(f.jobs.size, 0)

  const skipped = scheduledFixture(() => 0.99)
  await skipped.sound.unlock(); await settleLoads()
  assert.ok([...skipped.jobs.values()].some(job => job.delay >= 39000 && job.delay <= 40000))
  skipped.advance(120000)
  assert.equal(oneShots(skipped).length, 0, 'not every meow or droplet opportunity must make sound')
  skipped.sound.dispose()
})

test('droplet snippets are sparse, softened with the rain, and removed on disposal', async () => {
  const f = scheduledFixture()
  await f.sound.unlock(); await settleLoads()
  f.advance(2999); assert.equal(oneShots(f).length, 0)
  f.advance(1)
  const first = oneShots(f)[0]
  assert.ok(first, 'a low probability opportunity can add a recorded window-drop detail')
  assert.equal(first.started.length, 3, 'a bounded fragment, not a second ambience loop')
  assert.ok(first.started[2] <= 0.7)
  const baseline = first.connections[0].gain.ramps[0].value
  assert.ok(baseline > 0 && baseline < 0.15)
  first.onended()
  f.sound.applyEvent('rain_softens'); f.advance(3000)
  const soft = oneShots(f).at(-1)
  assert.ok(soft.connections[0].gain.ramps[0].value < baseline)
  soft.onended()
  f.sound.applyEvent('rain_intensifies'); f.advance(3000)
  const strong = oneShots(f).at(-1)
  assert.ok(strong.connections[0].gain.ramps[0].value > baseline)
  assert.ok(strong.connections[0].gain.ramps[0].value < 0.15)
  f.sound.dispose()
  assert.equal(f.jobs.size, 0)
  assert.ok(f.nodes.every(n => n.connections.length === 0))
})

test('muted or suspended opportunities are discarded and never replay on unmute', async () => {
  const f = scheduledFixture()
  await f.sound.unlock(); await settleLoads()
  f.sound.setMuted(true); f.advance(40000)
  assert.equal(oneShots(f).length, 0)
  f.sound.setMuted(false)
  assert.equal(oneShots(f).length, 0, 'unmute restores bed only; no backlog')
  f.context.state = 'suspended'; f.advance(40000)
  assert.equal(oneShots(f).length, 0)
  f.context.state = 'running'; f.advance(20000)
  assert.ok(oneShots(f).some(n => n.started.length === 1))
  f.sound.dispose()
})

test('optional detail and meow failures do not disable rain or door playback', async () => {
  const f = scheduledFixture(() => 0, async url => ({ ok: url.endsWith('rain-loop.mp3'), arrayBuffer: async () => new ArrayBuffer(8) }))
  await f.sound.unlock(); await settleLoads()
  assert.equal(f.states.at(-1).status, 'running')
  f.advance(60000); assert.equal(oneShots(f).length, 0)
  f.sound.applyEvent('door_noise')
  assert.equal(f.nodes.filter(n => n.kind === 'oscillator').length, 1)
  f.sound.dispose(); assert.equal(f.jobs.size, 0)
})

test('disposing while optional assets decode prevents late cues and clears every timer', async () => {
  const pending = []
  const f = scheduledFixture(() => 0, async (url, { signal }) => {
    if (url.endsWith('rain-loop.mp3')) return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
    return { ok: true, arrayBuffer: () => new Promise(resolve => pending.push({ signal, resolve })) }
  })
  await f.sound.unlock(); await settleLoads()
  assert.equal(pending.length, 2)
  f.sound.dispose()
  assert.ok(pending.every(load => load.signal.aborted))
  assert.equal(f.jobs.size, 0, 'even uncooperative pending optional loads have no live timer')
  for (const load of pending) load.resolve(new ArrayBuffer(8))
  await settleLoads(); f.advance(80000)
  assert.equal(oneShots(f).length, 0)
})

test('muting active detail cues releases them and unmute does not replay their tail', async () => {
  const f = scheduledFixture()
  await f.sound.unlock(); await settleLoads()
  f.advance(20000)
  const active = oneShots(f)
  assert.equal(active.length, 2)
  f.sound.setMuted(true)
  assert.ok(active.every(n => n.stops === 1 && n.connections.length === 0))
  f.sound.setMuted(false)
  assert.equal(oneShots(f).length, 2)
  f.sound.dispose()
})
