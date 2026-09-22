import { npcActivities } from '../shared/npcActivities.js'

export function validNpcActivity(npcId, activity) {
  return activity === undefined || (typeof activity === 'string' &&
    Object.hasOwn(npcActivities, npcId) && npcActivities[npcId].includes(activity))
}

const descriptions = {
  kai: {
    behind_counter: 'Kai is currently tending the checkout counter.',
    making_coffee: 'Kai is currently preparing coffee.',
    checking_shelf: 'Kai is currently checking and restocking merchandise.',
    looking_out_window: 'Kai is currently looking out at the rainy street.',
  },
  mira: {
    reading_notes: 'Mira is currently working on her paper with her notebook.',
    checking_phone: 'Mira is currently checking her phone.',
    choosing_drink: 'Mira is currently choosing a drink by the refrigerator.',
    staring_out_window: 'Mira is currently gazing out at the rainy street.',
  },
}

export function buildNpcActivityContext(npcId, activity) {
  if (activity === undefined) return ''
  if (!validNpcActivity(npcId, activity) || !Object.hasOwn(descriptions, npcId)) throw new RangeError('Invalid NPC activity')
  return `${descriptions[npcId][activity]} This is the current semantic activity; the character may be on the way to it. Acknowledge it naturally only when relevant to what the player says. Do not mention the activity mechanically in every response or invent completed actions.`
}
