// Order defines the deterministic ambient cycle. No scene coordinates or dialogue data.
export const npcActivities = Object.freeze({
  kai: Object.freeze(['behind_counter', 'making_coffee', 'checking_shelf', 'looking_out_window']),
  mira: Object.freeze(['reading_notes', 'checking_phone', 'choosing_drink', 'staring_out_window']),
  cat: Object.freeze(['sleeping', 'grooming', 'watching_door', 'wandering']),
})

export const ambientIntervals = Object.freeze({ kai: 37000, mira: 53000, cat: 71000 })
export const ambientNpcIds = Object.freeze(Object.keys(npcActivities))

export function requireNpcActivity(npcId, activity) {
  if (!Object.hasOwn(npcActivities, npcId)) throw new RangeError('Unknown ambient NPC')
  if (!npcActivities[npcId].includes(activity)) throw new RangeError('Invalid NPC activity')
  return activity
}

export function createInitialNpcActivities() {
  return Object.freeze(Object.fromEntries(ambientNpcIds.map(id => [id, npcActivities[id][0]])))
}
