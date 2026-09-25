import { validWorldEvent } from '../shared/worldEvents.js'

const descriptions = Object.freeze({
  rain_intensifies: 'The rain outside recently became heavier.',
  rain_softens: 'The rain outside recently became softer.',
  door_noise: 'A soft sound recently came from the store entrance; its cause is unknown.',
  quiet_lull: 'The store recently settled into a quiet lull, with rain still outside.',
})

export function buildWorldEventContext(id) {
  if (id === undefined) return ''
  if (!validWorldEvent(id)) throw new RangeError('Invalid world event')
  return `${descriptions[id]} Acknowledge this recent environment change naturally only when relevant. Do not announce it mechanically in every reply, invent a visitor, or assume the character performed any action in response.`
}
