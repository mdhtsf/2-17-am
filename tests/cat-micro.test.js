import test from 'node:test'
import assert from 'node:assert/strict'
import { createCatMicroBehaviors } from '../src/game/catMicroBehaviors.js'

function fixture(random = () => 0) {
  let serial = 0
  const timers = new Map(), poses = []
  const cat = createCatMicroBehaviors({ random, onPose: pose => poses.push(pose),
    setTimer: (fn, ms) => { const id = ++serial; timers.set(id, { fn, ms }); return id },
    clearTimer: id => timers.delete(id) })
  const fire = () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); return timer }
  return { cat, timers, poses, fire }
}
const settled = { activity: 'grooming', phase: 'idle', blocked: false }

test('settled cat briefly varies pose, restores prior activity and schedules another sparse opportunity', () => {
  const f = fixture(); f.cat.report(settled); f.cat.start()
  assert.equal(f.timers.size, 1); assert.equal(f.timers.values().next().value.ms, 60000)
  f.fire(); assert.equal(f.poses.at(-1), 'yawning')
  assert.equal(f.timers.values().next().value.ms, 2000)
  f.fire(); assert.equal(f.poses.at(-1), null)
  assert.equal(f.timers.values().next().value.ms, 60000)
  f.cat.stop(); assert.equal(f.timers.size, 0)
})
test('moving, sleeping or interaction/world-blocked cat never starts a micro pose', () => {
  for (const state of [{ ...settled, phase: 'walking' }, { ...settled, activity: 'sleeping' }, { ...settled, blocked: true }]) {
    const f = fixture(); f.cat.report(state); f.cat.start()
    assert.equal(f.timers.size, 1); assert.equal(f.cat.trigger('scratching'), false)
    f.fire(); assert.equal(f.timers.size, 1)
    assert.deepEqual(f.poses, []); f.cat.stop()
  }
})
test('movement or new activity cancels pose; stale completion cannot clear a newer pose', () => {
  const f = fixture(); f.cat.report(settled); f.cat.start(); f.cat.trigger('yawning')
  const stale = f.timers.values().next().value.fn
  f.cat.report({ ...settled, phase: 'walking' }); assert.equal(f.poses.at(-1), null)
  f.cat.report({ ...settled, activity: 'watching_door' }); f.cat.trigger('scratching')
  stale(); assert.equal(f.poses.at(-1), 'scratching')
  f.cat.report({ ...settled, activity: 'watching_door', blocked: true }); assert.equal(f.poses.at(-1), null)
  assert.equal(f.timers.size, 1); f.cat.stop()
})
test('rerenders do not restart timers, skipped chances reschedule, stop guards callbacks', () => {
  const f = fixture(() => .9); f.cat.report(settled); f.cat.start()
  const [id, timer] = f.timers.entries().next().value
  assert.ok(timer.ms >= 60000 && timer.ms <= 100000)
  f.cat.report({ ...settled }); assert.ok(f.timers.has(id))
  f.fire(); assert.deepEqual(f.poses, []); assert.equal(f.timers.size, 1)
  f.cat.stop(); timer.fn(); assert.equal(f.timers.size, 0)
})
test('ordinary movement and world events do not continually restart the sparse opportunity clock', () => {
  const f = fixture(); f.cat.report(settled); f.cat.start()
  const id = f.timers.keys().next().value
  f.cat.report({ ...settled, phase: 'walking' })
  f.cat.report({ ...settled, activity: 'watching_door' })
  f.cat.report({ ...settled, blocked: true })
  f.cat.report(settled)
  assert.ok(f.timers.has(id), 'opportunity keeps its original deadline across routine changes')
  f.fire(); assert.equal(f.poses.at(-1), 'yawning')
  f.cat.stop()
})
