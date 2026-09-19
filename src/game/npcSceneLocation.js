import { requireNpcActivity } from '../data/npcActivities.js'
import { npcActivityLocations, npcSceneLocations } from '../data/npcSceneLocations.js'

// Derived data, never a second mutable state store or a source of hotspot coordinates.
export function getNpcSceneLocation(npcId, activity) {
  requireNpcActivity(npcId, activity)
  const location = npcActivityLocations[npcId][activity]
  if (!npcSceneLocations[npcId].includes(location)) throw new RangeError('Invalid NPC scene location mapping')
  return location
}
