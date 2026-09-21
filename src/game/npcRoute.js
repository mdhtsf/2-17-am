import { sceneWaypoints, sceneWaypointEdges } from '../data/sceneWaypoints.js'
import { getMovementDistance } from './npcMovement.js'

function requirePoint(value) {
  const id = typeof value === 'string' ? value : Object.keys(sceneWaypoints).find(key =>
    sceneWaypoints[key].x === value?.x && sceneWaypoints[key].y === value?.y)
  if (!Object.hasOwn(sceneWaypoints, id)) throw new RangeError('Unknown scene waypoint')
  return sceneWaypoints[id]
}

export function resolveNpcRoute(start, target) {
  const from = requirePoint(start)
  const to = requirePoint(target)
  if (from.id === to.id) return [] // Already at destination.
  const queue = [[from.id]]
  const visited = new Set([from.id])
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i]
    const current = path.at(-1)
    for (const edge of sceneWaypointEdges) {
      const next = edge[0] === current ? edge[1] : edge[1] === current ? edge[0] : null
      if (!next || visited.has(next)) continue
      const route = [...path, next]
      if (next === to.id) return route.slice(1).map(id => sceneWaypoints[id])
      visited.add(next)
      queue.push(route)
    }
  }
  throw new RangeError('No walkable route to destination')
}

export function resolveInterruptedRoute(from, to, position, target) {
  const a = requirePoint(from)
  const b = requirePoint(to)
  requirePoint(target)
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) throw new RangeError('Invalid route position')
  if (a.id === b.id || !sceneWaypointEdges.some(edge => edge.includes(a.id) && edge.includes(b.id))) throw new RangeError('Not a walkable edge')
  const dx = b.x - a.x
  const dy = b.y - a.y
  const along = ((position.x - a.x) * dx + (position.y - a.y) * dy) / (dx * dx + dy * dy)
  const away = Math.abs((position.x - a.x) * dy - (position.y - a.y) * dx) / Math.hypot(dx, dy)
  // Allow subpixel CSS rounding, but reject arbitrary off-corridor shortcuts.
  if (along < -.005 || along > 1.005 || away > .1) throw new RangeError('Position is outside occupied corridor')
  // Pick an endpoint of the occupied edge, never a nearest node across furniture.
  const options = [b, a].map(endpoint => {
    const route = [endpoint, ...resolveNpcRoute(endpoint.id, target)]
    const distance = route.reduce((total, point, index) => total + getMovementDistance(index ? route[index - 1] : position, point), 0)
    return { route, distance }
  })
  options.sort((first, second) => first.distance - second.distance)
  return options[0].route
}
