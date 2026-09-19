import { useCallback, useEffect, useReducer } from 'react'
import { ambientIntervals, ambientNpcIds, createInitialNpcActivities, requireNpcActivity } from '../data/npcActivities.js'
import { nextNpcActivity } from '../game/npcActivityTransitions.js'

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

export function useNpcActivities({ intervals = ambientIntervals } = {}) {
  const [activities, dispatch] = useReducer(npcActivityReducer, undefined, createInitialNpcActivities)
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
  const { kai, mira, cat } = intervals

  useEffect(() => {
    const delays = [kai, mira, cat]
    // Check all delays before creating any timer, including in test configurations.
    if (delays.some(delay => !Number.isInteger(delay) || delay <= 0 || delay > 2147483647)) {
      throw new RangeError('Ambient intervals must be positive timer-safe milliseconds')
    }
    const timers = ambientNpcIds.map((npcId, index) =>
      setInterval(() => advanceNpcActivity(npcId), delays[index]))
    return () => timers.forEach(timer => clearInterval(timer))
  }, [kai, mira, cat, advanceNpcActivity])

  return { activities, getNpcActivity, setNpcActivity, advanceNpcActivity, resetNpcActivities }
}
