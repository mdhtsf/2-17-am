import { requestSocialDialogue } from '../lib/socialChat.js'
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { ambientNpcIds, createInitialNpcActivities, requireNpcActivity } from '../data/npcActivities.js'
import { nextNpcActivity } from '../game/npcActivityTransitions.js'
import { createCounterCoherence } from '../game/counterCoherence.js'
import { createFiniteActivities } from '../game/finiteActivities.js'
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

export function useNpcActivities({ interactingId = null, catInteracting = false } = {}) {
  const [activities, dispatch] = useReducer(npcActivityReducer, undefined, createInitialNpcActivities)
  const latest = useRef(activities)
  latest.current = activities
  const getNpcActivity = useCallback(npcId => requireNpcActivity(npcId, activities[npcId]), [activities])
  const setNpcActivity = useCallback((npcId, activity) => {
    requireNpcActivity(npcId, activity)
    latest.current = npcActivityReducer(latest.current, { type: 'set', npcId, activity })
    dispatch({ type: 'set', npcId, activity })
  }, [])
  const advanceNpcActivity = useCallback(npcId => {
    // Validate before dispatch; the reducer advances from the latest snapshot.
    if (!ambientNpcIds.includes(npcId)) throw new RangeError('Unknown ambient NPC')
    latest.current = npcActivityReducer(latest.current, { type: 'advance', npcId })
    dispatch({ type: 'advance', npcId })
  }, [])
  const resetNpcActivities = useCallback(() => { latest.current = createInitialNpcActivities(); dispatch({ type: 'reset' }) }, [])
  const [director] = useState(() => createAmbientDirector({
    getActivities: () => latest.current,
    onActivity: setNpcActivity,
  }))
  const [speech, setSpeech] = useState(null)
  const [coherence] = useState(() => createCounterCoherence({
    onDebug: import.meta.env.DEV ? detail => window.dispatchEvent(new CustomEvent('counter-social-debug', { detail })) : undefined,
    generate: requestSocialDialogue, director, getActivities: () => latest.current, assign: setNpcActivity, onSpeech: setSpeech,
  }))
  const [completedActivities, setCompletedActivities] = useState({})
  const [finite] = useState(() => createFiniteActivities({
    onComplete: (id, activity) => {
      setCompletedActivities(previous => ({ ...previous, [id]: activity }))
      coherence.complete(id, activity)
    },
    onReset: id => setCompletedActivities(previous => previous[id] == null ? previous : { ...previous, [id]: null }),
  }))
  const [movementObservers] = useState(() => Object.fromEntries(ambientNpcIds.map(id =>
    [id, (movement, activity) => {
      director.reportMovement(id, movement)
      if (activity) finite.report(id, activity, movement)
      coherence.report(id, movement)
    }])))
  useLayoutEffect(() => {
    const locks = [interactingId || (catInteracting ? 'cat' : null)]
    director.setInteractionLocks(locks)
    coherence.setInteractionLocks(locks)
  }, [director, coherence, interactingId, catInteracting])
  useEffect(() => {
    director.start()
    finite.start()
    coherence.start()
    return () => { director.stop(); finite.stop(); coherence.stop() }
  }, [director, finite, coherence])

  return { activities, completedActivities, speech, getNpcActivity, setNpcActivity, advanceNpcActivity, resetNpcActivities, movementObservers }
}
