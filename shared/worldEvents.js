export const worldEventIds = Object.freeze([
  'rain_intensifies', 'rain_softens', 'door_noise', 'quiet_lull',
])

export function validWorldEvent(id) {
  return id === undefined || (typeof id === 'string' && worldEventIds.includes(id))
}
