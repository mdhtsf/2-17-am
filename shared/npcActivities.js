// Valid activities and initial poses. Order also supports the manual dev cycle;
// automatic scheduling belongs to the centralized Ambient Activity Director.
export const npcActivities = Object.freeze({
  kai: Object.freeze(['behind_counter', 'making_coffee', 'checking_shelf', 'looking_out_window']),
  mira: Object.freeze(['reading_notes', 'checking_phone', 'choosing_drink', 'staring_out_window', 'talking_to_kai']),
  cat: Object.freeze(['sleeping', 'grooming', 'watching_door', 'wandering']),
})

export const ambientNpcIds = Object.freeze(Object.keys(npcActivities))

export function requireNpcActivity(npcId, activity) {
  if (!Object.hasOwn(npcActivities, npcId)) throw new RangeError('Unknown ambient NPC')
  if (!npcActivities[npcId].includes(activity)) throw new RangeError('Invalid NPC activity')
  return activity
}

export function createInitialNpcActivities() {
  return Object.freeze(Object.fromEntries(ambientNpcIds.map(id => [id, npcActivities[id][0]])))
}

// Only short tasks finish themselves. Persistent ambient states have no deadline.
export const finiteActivityDurations = Object.freeze({
  kai: Object.freeze({
    making_coffee: Object.freeze([5000, 10000]),
    checking_shelf: Object.freeze([5000, 10000]),
  }),
})

// Autonomous choices exclude manual-only travel and the reserved social activity.
export const ambientActivityChoices = Object.freeze({
  kai: Object.freeze(['behind_counter', 'making_coffee', 'checking_shelf']),
  mira: Object.freeze(npcActivities.mira.filter(activity => activity !== 'talking_to_kai')),
  cat: npcActivities.cat,
})
