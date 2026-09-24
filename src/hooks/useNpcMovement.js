import { useLayoutEffect, useRef, useState } from 'react'
import { getMovementDirection, getMovementDuration, HUMAN_MOVEMENT } from '../game/npcMovement.js'
import { resolveNpcRoute, resolveInterruptedRoute } from '../game/npcRoute.js'
import { sceneWaypoints, getNpcWaypoint } from '../data/sceneWaypoints.js'
import { getSegmentLayer } from '../game/sceneDepth.js'

const IDLE = { direction: null, phase: 'idle', segment: 0, route: [] }

// Navigation progress is transient presentation state: a node / occupied edge,
// never another world position. Logical destination still derives from activity.
export function useNpcMovement(anchor, entityRef, enabled, logicalLocation, npcId = 'kai', config = HUMAN_MOVEMENT) {
  const previous = useRef(null)
  const progress = useRef({ node: null, edge: null })
  const segment = useRef(0)
  const [movement, setMovement] = useState(IDLE)

  useLayoutEffect(() => {
    if (!enabled) return
    const destination = logicalLocation ? getNpcWaypoint(npcId, logicalLocation) : null
    const entity = entityRef.current
    const prior = previous.current
    previous.current = anchor
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const place = point => {
      entity.style.left = `${point.x}%`
      entity.style.top = `${point.y}%`
      entity.style.setProperty('--npc-scale', point.scale)
      entity.style.zIndex = point.zIndex
    }
    const atDestination = () => {
      progress.current = { node: destination, edge: null }
      setMovement({ ...IDLE, destination: logicalLocation })
    }
    if (!prior || !getMovementDirection(prior, anchor) || reducedMotion.matches) {
      if (destination) resolveNpcRoute(destination, destination) // Validate even on initial mount.
      place(anchor)
      atDestination()
      return
    }

    const readPosition = () => {
      const style = getComputedStyle(entity)
      const parent = entity.offsetParent.getBoundingClientRect()
      return { x: parseFloat(style.left) / parent.width * 100,
        y: parseFloat(style.top) / parent.height * 100, transform: style.transform }
    }
    const occupiedEdge = progress.current.edge
    const origin = readPosition()
    // Bare anchors remain supported for the isolated segment renderer tests.
    // Every production moving entity provides a validated logical destination.
    const route = logicalLocation
      ? occupiedEdge
        ? resolveInterruptedRoute(...occupiedEdge, origin, destination)
        : resolveNpcRoute(progress.current.node, destination)
      : [{ ...anchor, id: 'anchor' }]
    const routeFrom = occupiedEdge ? occupiedEdge.find(id => id !== route[0]?.id) : progress.current.node
    let index = 0
    let phase = 'walking'
    let disposed = false
    let timer
    let current
    let finishSegment

    const idle = () => {
      if (disposed) return
      window.clearTimeout(timer)
      phase = 'idle'
      atDestination()
    }
    const settle = () => {
      phase = 'settling'
      setMovement({ ...current, phase })
      timer = window.setTimeout(idle, config.settleMs)
    }
    const startSegment = () => {
      if (disposed) return
      window.clearTimeout(timer)
      if (index >= route.length) { if (current) settle(); else idle(); return }
      const next = route[index]
      const position = readPosition()
      const direction = getMovementDirection(position, next)
      const duration = getMovementDuration(position, next, config)
      const fromId = index === 0 && occupiedEdge
        ? occupiedEdge.find(id => id !== next.id)
        : progress.current.node
      const from = logicalLocation ? sceneWaypoints[fromId] : position
      if (logicalLocation) progress.current.edge = [fromId, next.id]

      // Freeze only the DOM presentation, then replace this segment at the same
      // foot position. Scale uses the same bottom-origin transform as movement.
      entity.style.transition = 'none'
      entity.style.left = `${position.x}%`
      entity.style.top = `${position.y}%`
      entity.style.transform = position.transform
      void entity.offsetWidth
      entity.style.setProperty('--npc-move-duration', `${duration}ms`)
      entity.style.removeProperty('transition')
      entity.style.removeProperty('transform')
      place(next)
      entity.style.zIndex = logicalLocation ? getSegmentLayer(from, next) : next.zIndex
      void entity.offsetWidth

      // Subpixel endpoint corrections must not flash a complete walk/settle cycle.
      if (!duration) {
        entity.style.zIndex = next.zIndex
        progress.current = { node: logicalLocation ? next.id : null, edge: null }
        index++
        startSegment()
        return
      }
      current = { direction, phase: 'walking', segment: ++segment.current,
        route: route.map(point => point.id), routeFrom, segmentFrom: fromId, segmentTo: next.id,
        destination: logicalLocation }
      setMovement(current)
      let completed = false
      finishSegment = () => {
        if (disposed || completed || phase !== 'walking') return
        completed = true
        window.clearTimeout(timer)
        entity.style.zIndex = next.zIndex
        progress.current = { node: logicalLocation ? next.id : null, edge: null }
        index++
        startSegment() // No idle / settle between waypoints.
      }
      timer = window.setTimeout(finishSegment, duration + config.completionGraceMs)
    }
    const onArrival = event => {
      if (event.target !== entity || !['left', 'top'].includes(event.propertyName)) return
      if (!entity.getAnimations().some(animation =>
        ['left', 'top'].includes(animation.transitionProperty) && animation.playState === 'running')) finishSegment?.()
    }
    const onPreferenceChange = event => {
      if (!event.matches) return
      place(anchor)
      idle()
    }
    entity.addEventListener('transitionend', onArrival)
    reducedMotion.addEventListener('change', onPreferenceChange)
    startSegment()
    return () => {
      disposed = true
      window.clearTimeout(timer)
      entity.removeEventListener('transitionend', onArrival)
      reducedMotion.removeEventListener('change', onPreferenceChange)
    }
  }, [anchor.x, anchor.y, entityRef, enabled, logicalLocation, npcId, config])

  return movement
}
