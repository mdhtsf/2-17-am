import { ambientNpcIds, npcActivities } from '../data/npcActivities.js'
import { getNpcSceneLocation } from './npcSceneLocation.js'
import { getNpcWaypoint, sceneWaypoints } from '../data/sceneWaypoints.js'
import { resolveNpcRoute } from './npcRoute.js'
import { getMovementDistance } from './npcMovement.js'

export const AMBIENT_DIRECTOR = Object.freeze({
  firstDelayMs: Object.freeze([8000, 14000]),
  nextDelayMs: Object.freeze([16000, 28000]),
  // Art-space route distance, including every existing waypoint segment.
  shortDistance: 400,
  mediumDistance: 900,
  distanceWeights: Object.freeze([4, 2, 0.5]),
  cooldownEvents: 2,
  cooldownWeight: 0.35,
})

export function ambientDelay(first, random = Math.random) {
  const [min, max] = first ? AMBIENT_DIRECTOR.firstDelayMs : AMBIENT_DIRECTOR.nextDelayMs
  return min + Math.floor(random() * (max - min + 1))
}

export function activityChoices(npcId, currentActivity) {
  const origin = getNpcWaypoint(npcId, getNpcSceneLocation(npcId, currentActivity))
  return npcActivities[npcId].filter(activity => activity !== currentActivity).map(activity => {
    const destination = getNpcSceneLocation(npcId, activity)
    const route = resolveNpcRoute(origin, getNpcWaypoint(npcId, destination))
    const distance = route.reduce((total, point, index) => total +
      getMovementDistance(index ? route[index - 1] : sceneWaypoints[origin], point), 0)
    const band = distance <= AMBIENT_DIRECTOR.shortDistance ? 0
      : distance <= AMBIENT_DIRECTOR.mediumDistance ? 1 : 2
    return { activity, destination, distance, weight: AMBIENT_DIRECTOR.distanceWeights[band] }
  })
}

function weightedChoice(choices, random) {
  let remaining = random() * choices.reduce((sum, choice) => sum + choice.weight, 0)
  return choices.find(choice => (remaining -= choice.weight) < 0) || choices.at(-1)
}

export function chooseAmbientEvent(activities, recent = [], random = Math.random) {
  const candidates = ambientNpcIds.filter(id => id !== recent.at(-1))
  const { id } = weightedChoice(candidates.map(id => ({
    id, weight: recent.includes(id) ? AMBIENT_DIRECTOR.cooldownWeight : 1,
  })), random)
  return { npcId: id, ...weightedChoice(activityChoices(id, activities[id]), random) }
}

// One reservation and one timeout for the whole scene. Movement reports arrive
// from the existing renderer; no duration estimates, routing or polling here.
export function createAmbientDirector({ getActivities, onActivity, random = Math.random,
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = timer => clearTimeout(timer) }) {
  let running = false
  let timer = null
  let first = true
  let pending = null
  let recent = []
  const movements = new Map()
  const settled = () => ambientNpcIds.every(id => movements.get(id)?.phase === 'idle')
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null }
  const schedule = () => {
    if (!running || timer !== null || pending || !settled()) return
    timer = setTimer(() => {
      timer = null
      if (!running || pending || !settled()) return
      const event = chooseAmbientEvent(getActivities(), recent, random)
      // Reserve before React dispatch so another event cannot race the first
      // walking report. Same-location/reduced-motion idle reports also release it.
      pending = event
      first = false
      recent = [...recent, event.npcId].slice(-AMBIENT_DIRECTOR.cooldownEvents)
      onActivity(event.npcId, event.activity)
    }, ambientDelay(first, random))
  }
  return {
    start() { running = true; schedule() },
    stop() { running = false; cancel() },
    reportMovement(npcId, movement) {
      if (!ambientNpcIds.includes(npcId)) throw new RangeError('Unknown ambient NPC')
      movements.set(npcId, movement)
      if (!settled()) cancel()
      if (pending?.npcId === npcId && movement.phase === 'idle' &&
          movement.destination === pending.destination) pending = null
      schedule()
    },
  }
}
