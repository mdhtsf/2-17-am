import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ambientNpcIds, createInitialNpcActivities, requireNpcActivity } from '../data/npcActivities.js'
import { nextNpcActivity } from '../game/npcActivityTransitions.js'
import { createAmbientDirector } from '../game/ambientDirector.js'

export function npcActivityReducer(activities, action) {
  if (action.type === 'reset') return createInitialNpcActivities()
  requireNpcActivity(action.npcId, activities[action.npcId])
  let next
  if (action.type === 'set') next = requireNpcActivity(action.npcId, action.activity)
  else if (action.type === 'advance') next = nextNpcActivity(action.npcId, activities[action.npcId])
  else throw new TypeError('Unknown NPC activity action')
  return next === activities[action.npcId]
    ? activities : Object.freeze({ ...activities, [action.npcId]: next })
}

export function useNpcActivities() {
  const [activities, dispatch] = useReducer(npcActivityReducer, undefined, createInitialNpcActivities)
  const latest = useRef(activities)
  useEffect(() => { latest.current = activities }, [activities])
  const getNpcActivity = useCallback(npcId => requireNpcActivity(npcId, activities[npcId]), [activities])
  const setNpcActivity = useCallback((npcId, activity) => {
    requireNpcActivity(npcId, activity)
    dispatch({ type: 'set', npcId, activity })
  }, [])
  const advanceNpcActivity = useCallback(npcId => {
    // Validate before dispatch; the reducer advances from the latest snapshot.
    if (!ambientNpcIds.includes(npcId)) throw new RangeError('Unknown ambient NPC')
    dispatch({ type: 'advance', npcId })
  }, [])
  const resetNpcActivities = useCallback(() => dispatch({ type: 'reset' }), [])
  const [director] = useState(() => createAmbientDirector({
    getActivities: () => latest.current,
    onActivity: (npcId, activity) => dispatch({ type: 'set', npcId, activity }),
  }))
  const [movementObservers] = useState(() => Object.fromEntries(ambientNpcIds.map(id =>
    [id, movement => director.reportMovement(id, movement)])))
  useEffect(() => {
    director.start()
    return () => director.stop()
  }, [director])

  return { activities, getNpcActivity, setNpcActivity, advanceNpcActivity, resetNpcActivities, movementObservers }
}
