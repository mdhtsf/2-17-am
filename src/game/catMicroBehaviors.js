// Local visual variations only. Never assign an activity or reserve a movement.
export const CAT_MICRO = Object.freeze({ opportunityMs: [60000, 100000], durationMs: [2000, 4000], probability: 0.5 })
export function createCatMicroBehaviors({ onPose, random = Math.random,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
  let running = false, state = null, ticket = null, timer = null, pose = null
  const safe = () => state?.phase === 'idle' && !state.blocked && ['grooming', 'watching_door', 'wandering'].includes(state.activity)
  const delay = ([min, max]) => min + Math.floor(random() * (max - min + 1))
  function cancel() {
    if (timer !== null) clearTimer(timer)
    timer = null; ticket = null
    if (pose !== null) { pose = null; onPose(null) }
  }
  function later(fn, ms) {
    const ownTicket = {}; ticket = ownTicket
    timer = setTimer(() => {
      if (!running || ticket !== ownTicket) return
      timer = null; ticket = null; fn()
    }, ms)
  }
  function schedule() {
    if (!running || timer !== null) return
    later(() => {
      if (safe() && random() < CAT_MICRO.probability) trigger(random() < 0.5 ? 'yawning' : 'scratching')
      else schedule()
    }, delay(CAT_MICRO.opportunityMs))
  }
  function trigger(next) {
    if (!running || !safe() || pose || !['yawning', 'scratching'].includes(next)) return false
    cancel(); pose = next; onPose(next)
    later(() => { pose = null; onPose(null); schedule() }, delay(CAT_MICRO.durationMs))
    return true
  }
  return {
    start() { running = true; schedule() },
    stop() { running = false; cancel() },
    report(next) {
      if (state?.activity === next.activity && state?.phase === next.phase && state?.blocked === next.blocked) return
      state = next
      // Keep the rare opportunity clock across ordinary world/activity changes;
      // otherwise frequent director events could postpone it forever. Only an
      // active micro pose is cancelled. Unsafe opportunities are simply skipped.
      if (pose !== null) cancel()
      schedule()
    },
    trigger,
  }
}
