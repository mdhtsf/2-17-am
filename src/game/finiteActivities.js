import { finiteActivityDurations, requireNpcActivity } from '../../shared/npcActivities.js'
import { getNpcSceneLocation } from './npcSceneLocation.js'

// Arrival-local task clock. It never selects an activity or instructs movement.
export function createFiniteActivities({ onComplete, onReset, random = Math.random,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
  const records = new Map()
  let running = false
  const cancel = record => {
    if (record.timer !== null) clearTimer(record.timer)
    record.timer = null
    record.token = null
  }
  const schedule = (id, record) => {
    const range = finiteActivityDurations[id]?.[record.activity]
    if (!running || !range || record.complete || record.token || record.movement.phase !== 'idle'
      || record.movement.destination !== getNpcSceneLocation(id, record.activity)) return
    const token = {}
    record.token = token
    record.timer = setTimer(() => {
      if (!running || records.get(id) !== record || record.token !== token) return
      record.timer = null
      record.token = null
      record.complete = true
      onComplete(id, record.activity)
    }, range[0] + Math.floor(random() * (range[1] - range[0] + 1)))
  }
  return {
    report(id, activity, movement) {
      requireNpcActivity(id, activity)
      let record = records.get(id)
      if (!record || record.activity !== activity) {
        if (record) cancel(record)
        record = { activity, movement, complete: false, timer: null, token: null }
        records.set(id, record)
        onReset(id)
      }
      record.movement = movement
      if (movement.phase !== 'idle' || movement.destination !== getNpcSceneLocation(id, activity)) cancel(record)
      schedule(id, record)
    },
    start() { running = true; records.forEach((record, id) => schedule(id, record)) },
    stop() { running = false; records.forEach(cancel) },
  }
}
