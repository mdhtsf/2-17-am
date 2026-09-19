import { npcActivities, requireNpcActivity } from '../data/npcActivities.js'

export function nextNpcActivity(npcId, currentActivity) {
  requireNpcActivity(npcId, currentActivity)
  const cycle = npcActivities[npcId]
  return cycle[(cycle.indexOf(currentActivity) + 1) % cycle.length]
}
