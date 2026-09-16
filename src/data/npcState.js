// Runtime defaults are separate from public character text and conversation history.
// All fields are primitive values; each page session receives fresh state objects.
const INITIAL_NPC_STATE = Object.freeze({
  kai: Object.freeze({ mood: 'neutral', familiarity: 0, trust: 0, hasMetPlayer: false }),
  mira: Object.freeze({ mood: 'exhausted', familiarity: 0, trust: 0, hasMetPlayer: false, deadlineStress: 'high' }),
})

export function createInitialNpcState() {
  return Object.freeze(Object.fromEntries(
    Object.entries(INITIAL_NPC_STATE).map(([id, state]) => [id, Object.freeze({ ...state })]),
  ))
}
