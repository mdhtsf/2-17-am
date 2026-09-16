export const MAX_FAMILIARITY = 5

// Game rules only: no React, history, transport or persistence dependencies.
export function applyNpcStateEvent(npcId, currentState, event) {
  if (npcId !== 'kai' && npcId !== 'mira') throw new RangeError('Unknown runtime NPC')
  if (event?.type !== 'dialogue_completed') return currentState
  return {
    ...currentState,
    hasMetPlayer: true,
    familiarity: Math.min(currentState.familiarity + 1, MAX_FAMILIARITY),
  }
}
