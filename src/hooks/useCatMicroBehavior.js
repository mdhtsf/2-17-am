import { useEffect, useLayoutEffect, useState } from 'react'
import { createCatMicroBehaviors } from '../game/catMicroBehaviors.js'

export function useCatMicroBehavior(activity, phase, blocked) {
  const [pose, setPose] = useState(null)
  const [controller] = useState(() => createCatMicroBehaviors({ onPose: setPose }))
  useLayoutEffect(() => { controller.report({ activity, phase, blocked }) }, [controller, activity, phase, blocked])
  useEffect(() => { controller.start(); return () => controller.stop() }, [controller])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const trigger = event => controller.trigger(event.detail?.pose)
    window.addEventListener('cat-micro-trigger', trigger)
    return () => window.removeEventListener('cat-micro-trigger', trigger)
  }, [controller])
  // Invalidate immediately on the render that begins moving, before effects run.
  return phase === 'idle' && !blocked ? pose : null
}
