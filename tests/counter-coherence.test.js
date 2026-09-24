import test from 'node:test'
import assert from 'node:assert/strict'
import { createCounterCoherence } from '../src/game/counterCoherence.js'
import { createAmbientDirector, activityChoices } from '../src/game/ambientDirector.js'
import { createInitialNpcActivities } from '../shared/npcActivities.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'
import { getNpcWaypoint, sceneWaypointEdges } from '../src/data/sceneWaypoints.js'
import { counterConversations } from '../src/data/counterConversations.js'

function fixture(random = () => 0, generate = null) {
  const debugEvents = []
  const timers = new Map(), speech = [], assignments = [], ambientEvents = []
  let activities = { ...createInitialNpcActivities() }, serial = 0
  const clock = { setTimer: (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }, clearTimer: id => timers.delete(id) }
  const assign = (id, activity) => { activities = { ...activities, [id]: activity }; assignments.push([id, activity]) }
  const director = createAmbientDirector({ ...clock, random, getActivities: () => activities,
    onActivity: (id, activity) => { ambientEvents.push([id, activity]); assign(id, activity) } })
  const coherence = createCounterCoherence({ ...clock, random, generate, onDebug: event => debugEvents.push(event), director, getActivities: () => activities, assign, onSpeech: line => speech.push(line) })
  const report = (id, phase = 'idle', destination = getNpcSceneLocation(id, activities[id])) => {
    const movement = { phase, destination }
    director.reportMovement(id, movement); coherence.report(id, movement)
  }
  for (const id of ['kai', 'mira', 'cat']) report(id)
  director.start(); coherence.start()
  const fire = predicate => {
    const entry = [...timers].find(([, t]) => predicate(t.ms))
    assert.ok(entry, 'expected timer exists')
    timers.delete(entry[0]); entry[1].fn(); return entry[1].fn
  }
  return { debugEvents, coherence, director, timers, speech, assignments, ambientEvents, report, assign, fire, get activities() { return activities } }
}
const opportunity = ms => ms >= 90000
const line = ms => ms >= 2200 && ms <= 2800

test('Kai normal activities never include window; social spot reuses the existing exit node', () => {
  for (const activity of ['behind_counter', 'making_coffee', 'checking_shelf', 'looking_out_window']) {
    assert.ok(activityChoices('kai', activity).every(c => ['counter', 'coffee_station', 'shelf'].includes(c.destination)))
  }
  assert.equal(getNpcWaypoint('mira', 'counter_chat'), 'counter_exit')
  assert.ok(!sceneWaypointEdges.some(edge => edge.includes('mira_counter_chat')))
})
test('short-task completion returns Kai as cleanup, not another ambient event', () => {
  const f = fixture()
  f.assign('kai', 'making_coffee'); f.report('kai')
  f.coherence.complete('kai', 'making_coffee')
  assert.equal(f.activities.kai, 'behind_counter')
  assert.equal(f.ambientEvents.length, 0)
  assert.equal([...f.timers.values()].filter(t => t.ms < 90000).length, 0)
  f.report('kai', 'walking'); f.report('kai', 'idle')
  assert.ok([...f.timers.values()].some(t => t.ms === 8000))
})
test('interaction defers return; unlocking starts it once and newer activity wins', () => {
  const f = fixture()
  f.assign('kai', 'checking_shelf'); f.report('kai')
  f.coherence.setInteractionLocks(['kai'])
  f.coherence.complete('kai', 'checking_shelf')
  assert.equal(f.activities.kai, 'checking_shelf')
  f.coherence.setInteractionLocks([]); f.coherence.setInteractionLocks([])
  assert.equal(f.assignments.filter(([id, a]) => id === 'kai' && a === 'behind_counter').length, 1)
  const g = fixture()
  g.assign('kai', 'making_coffee'); g.report('kai'); g.coherence.setInteractionLocks(['kai'])
  g.coherence.complete('kai', 'making_coffee')
  g.assign('kai', 'checking_shelf'); g.report('kai'); g.coherence.setInteractionLocks([])
  assert.equal(g.activities.kai, 'checking_shelf')
})
test('cleanup waits for another NPC journey and takes the major-event gate on arrival', () => {
  const f = fixture()
  f.assign('kai', 'making_coffee'); f.report('kai'); f.report('cat', 'walking')
  f.coherence.complete('kai', 'making_coffee')
  assert.equal(f.activities.kai, 'making_coffee')
  f.report('cat')
  assert.equal(f.activities.kai, 'behind_counter')
  assert.equal(f.ambientEvents.length, 0)
})
test('social opportunity uses randomized 90–180 second cooldown and skips busy states', () => {
  for (const random of [() => 0, () => .5, () => .999999]) {
    const f = fixture(random)
    const ms = [...f.timers.values()].find(t => opportunity(t.ms)).ms
    assert.ok(ms >= 90000 && ms <= 180000)
    f.coherence.setInteractionLocks(['mira']); f.fire(opportunity)
    assert.equal(f.activities.mira, 'reading_notes')
    assert.equal(f.speech.filter(Boolean).length, 0)
    assert.ok([...f.timers.values()].some(t => opportunity(t.ms)))
  }
  const f = fixture(); f.report('cat', 'walking'); f.fire(opportunity)
  assert.equal(f.activities.mira, 'reading_notes')
})
test('social approach reserves the scene, waits for arrival and holds Kai at counter', () => {
  const f = fixture()
  const staleAmbient = [...f.timers.values()].find(t => t.ms === 8000).fn
  f.fire(opportunity); staleAmbient()
  assert.equal(f.activities.mira, 'talking_to_kai')
  assert.equal(f.activities.kai, 'behind_counter')
  assert.equal(f.ambientEvents.length, 0)
  f.report('mira', 'walking'); f.report('mira', 'idle', 'notes_spot')
  assert.equal(f.speech.filter(Boolean).length, 0)
  f.report('mira')
  assert.equal(f.speech.at(-1).npcId, 'mira')
  assert.equal(f.director.reserve('test'), false)
})
test('lines alternate, self-dismiss, restore Mira and release normal scheduling', () => {
  const f = fixture(); f.fire(opportunity); f.report('mira')
  f.fire(line); f.fire(line); f.fire(line)
  assert.deepEqual(f.speech.filter(Boolean).map(s => s.npcId), ['mira', 'kai', 'mira'])
  assert.equal(f.speech.at(-1), null)
  assert.equal(f.activities.mira, 'reading_notes')
  assert.equal(f.activities.kai, 'behind_counter')
  assert.equal(f.director.reserve('test'), false)
  f.report('mira')
  assert.ok([...f.timers.values()].some(t => t.ms === 8000))
  assert.equal(f.ambientEvents.length, 0)
  f.fire(opportunity); f.report('mira')
  assert.notEqual(f.speech.filter(Boolean).at(-1).key.split(':')[0], 'coffee')
})
test('player interruption dismisses bubbles and defers Mira departure until unlocked', () => {
  const f = fixture(); f.fire(opportunity); f.report('mira')
  const stale = [...f.timers.values()].find(t => line(t.ms)).fn
  f.coherence.setInteractionLocks(['mira']); stale()
  assert.equal(f.speech.at(-1), null)
  assert.equal(f.activities.mira, 'talking_to_kai')
  f.coherence.setInteractionLocks([])
  assert.equal(f.activities.mira, 'reading_notes')
})
test('new Mira activity cancels stale social restoration and stop clears callbacks', () => {
  const f = fixture(); f.fire(opportunity)
  f.assign('mira', 'choosing_drink'); f.report('mira', 'walking')
  assert.equal(f.activities.mira, 'choosing_drink')
  const stale = [...f.timers.values()].map(t => t.fn)
  f.director.stop(); f.coherence.stop()
  const count = f.assignments.length
  stale.forEach(fn => fn())
  assert.equal(f.timers.size, 0)
  assert.equal(f.assignments.length, count)
  assert.equal(f.speech.at(-1), null)
})
test('curated exchanges are short, alternating and local', () => {
  assert.ok(counterConversations.length >= 3)
  for (const exchange of counterConversations) {
    assert.ok(exchange.lines.length >= 2 && exchange.lines.length <= 4)
    exchange.lines.forEach((line, i) => {
      assert.equal(line.npcId, i % 2 ? 'kai' : 'mira')
      assert.ok(line.text.length < 40)
    })
  }
})

test('a completed line callback cannot skip the next line', () => {
  const f = fixture(); f.fire(opportunity); f.report('mira')
  const stale = f.fire(line)
  const before = f.speech.filter(Boolean).length
  stale()
  assert.equal(f.speech.filter(Boolean).length, before)
  assert.equal(f.speech.at(-1).npcId, 'kai')
})

const flush = () => new Promise(resolve => setImmediate(resolve))
test('generated exchange is ready during approach, then resumes previous activity', async () => {
  let calls=0
  const f=fixture(()=>0, async context=>{ calls++; assert.equal(context.miraPreviousActivity,'reading_notes'); return {lines:[{speaker:'mira',text:'屏幕还亮着。'},{speaker:'kai',text:'店也是。'}]} })
  f.fire(opportunity)
  assert.equal(f.activities.mira,'talking_to_kai'); assert.equal(f.speech.filter(Boolean).length,0)
  await flush(); assert.equal(calls,1)
  f.report('mira'); assert.equal(f.speech.at(-1).text,'屏幕还亮着。')
  f.fire(line); f.fire(line); assert.equal(f.activities.mira,'reading_notes')
  f.coherence.stop()
})
test('arrival does not cancel pending generation; request deadline discards late replies', async () => {
  let resolve, signal
  const f=fixture(()=>0,(_,s)=>{signal=s;return new Promise(r=>{resolve=r})})
  f.fire(opportunity); await flush(); f.report('mira')
  assert.equal(signal.aborted,false)
  assert.equal(f.speech.filter(Boolean).length,0)
  f.fire(ms=>ms===50000)
  assert.equal(signal.aborted,true)
  const first=f.speech.at(-1).text
  assert.equal(first,counterConversations[0].lines[0].text)
  resolve({lines:[{speaker:'mira',text:'迟到了。'},{speaker:'kai',text:'嗯。'}]});await flush()
  assert.equal(f.speech.at(-1).text,first);f.coherence.stop()
})
test('player interruption aborts generation and ignores stale result', async()=>{
 let resolve, signal
 const f=fixture(()=>0,(_,s)=>{signal=s;return new Promise(r=>{resolve=r})})
 f.fire(opportunity);await flush();f.coherence.setInteractionLocks(['mira'])
 assert.equal(signal.aborted,true)
 resolve({lines:[{speaker:'mira',text:'晚了。'},{speaker:'kai',text:'嗯。'}]});await flush()
 f.report('mira');assert.equal(f.speech.filter(Boolean).length,0)
 f.coherence.setInteractionLocks([]);assert.equal(f.activities.mira,'reading_notes');f.coherence.stop()
})
test('identical generated exchange is not replayed in consecutive session events', async () => {
 const generated={lines:[{speaker:'mira',text:'又是这一段。'},{speaker:'kai',text:'嗯。'}]}
 const f=fixture(()=>0,async()=>generated)
 f.fire(opportunity);await flush();f.report('mira');assert.equal(f.speech.at(-1).text,generated.lines[0].text)
 f.fire(line);f.fire(line);f.report('mira')
 f.fire(opportunity);await flush();f.report('mira')
 assert.notEqual(f.speech.at(-1).text,generated.lines[0].text);f.coherence.stop()
})

test('generation completing after arrival plays LLM and sends last three exchanges as data', async()=>{
 let resolve;const contexts=[]
 const f=fixture(()=>0,context=>{contexts.push(context);return new Promise(r=>{resolve=r})})
 for(let i=0;i<5;i++) {
  f.fire(opportunity);await flush();f.report('mira')
  assert.equal([...f.timers.values()].some(t=>t.ms===50000),true)
  resolve({lines:[{speaker:'kai',text:`第${i}次。`},{speaker:'mira',text:'嗯。'}]});await flush()
  assert.equal(f.speech.at(-1).npcId,'kai')
  assert.equal([...f.timers.values()].some(t=>t.ms===50000),false)
  f.fire(line);f.fire(line);f.report('mira')
 }
 assert.equal(contexts[4].recentExchanges.length,3)
 assert.equal(contexts[4].recentExchanges[0].lines[0].text,'第1次。')
 f.coherence.stop()
})

test('source diagnostics distinguish generated, timeout and generation error', async()=>{
 for(const [generator,expected,reason] of [
  [async()=>({lines:[{speaker:'kai',text:'夜里。'},{speaker:'mira',text:'嗯。'}]}),'llm',null],
  [async()=>({source:'fallback',reason:'invalid_output'}),'fallback','invalid_output'],
  [async()=>{throw new Error('network')},'fallback','network_error'],
  [()=>new Promise(()=>{}),'fallback','timeout'],
 ]) {
  const f=fixture(()=>0,generator);f.fire(opportunity);await flush();f.report('mira')
  if(reason==='timeout')f.fire(ms=>ms===50000)
  const event=f.debugEvents.find(e=>e.phase==='speaking')
  assert.equal(event.source,expected);assert.equal(event.reason,reason);f.coherence.stop()
 }
})
test('request timer starts before arrival, is not reset by arrival, and is cleared on interaction', async()=>{
 let signal
 const f=fixture(()=>0,(_,s)=>{signal=s;return new Promise(()=>{})})
 f.fire(opportunity);await flush()
 const before=[...f.timers].find(([,t])=>t.ms===50000)
 assert.ok(before)
 f.report('mira');f.report('mira')
 const after=[...f.timers].find(([,t])=>t.ms===50000)
 assert.equal(after[0],before[0]);assert.equal(signal.aborted,false)
 assert.equal(f.speech.filter(Boolean).length,0)
 f.coherence.setInteractionLocks(['mira'])
 assert.equal(signal.aborted,true);assert.equal(f.timers.has(before[0]),false)
 before[1].fn();assert.equal(f.speech.filter(Boolean).length,0)
 f.coherence.stop()
})
