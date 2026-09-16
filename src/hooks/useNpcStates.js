import { useCallback, useReducer } from 'react'
import { createInitialNpcState } from '../data/npcState.js'

function requireNpc(states, npcId) {
  if (!Object.hasOwn(states, npcId)) throw new RangeError('Unknown runtime NPC')
  return states[npcId]
}

// Pure container operations only; gameplay rules live in the transition layer.
export function npcStateReducer(states, action) {
  const previous = requireNpc(states, action.npcId)
  if (action.type === 'reset') {
    return Object.freeze({ ...states, [action.npcId]: createInitialNpcState()[action.npcId] })
  }
  if (action.type === 'update') {
    // Updaters receive a read-only snapshot and return a partial state object.
    const patch = action.updater(previous)
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('NPC state updater must return a state patch')
    }
    return Object.freeze({ ...states, [action.npcId]: Object.freeze({ ...previous, ...patch }) })
  }
  throw new TypeError('Unknown NPC state action')
}

export function useNpcStates() {
  const [npcStates, dispatch] = useReducer(npcStateReducer, undefined, createInitialNpcState)
  const getNpcState = useCallback(npcId => requireNpc(npcStates, npcId), [npcStates])
  const updateNpcState = useCallback((npcId, updater) => dispatch({ type: 'update', npcId, updater }), [])
  const resetNpcState = useCallback(npcId => dispatch({ type: 'reset', npcId }), [])
  return { npcStates, getNpcState, updateNpcState, resetNpcState }
}
