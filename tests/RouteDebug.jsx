import { sceneWaypoints, sceneWaypointEdges } from '../src/data/sceneWaypoints.js'
import { scene } from '../src/data/scene.js'
import { counterOcclusionOutline } from '../src/data/counterOcclusion.js'

export default function RouteDebug({ movement, npcId = 'kai' }) {
  if (!import.meta.env.DEV) return null
  const route = movement?.route || []
  const coordinates = id => `${sceneWaypoints[id].x * scene.width / 100},${sceneWaypoints[id].y * scene.height / 100}`
  return <svg className="route-debug" viewBox={`0 0 ${scene.width} ${scene.height}`} aria-label={`${npcId === 'kai' ? 'Kai' : 'Mira'} waypoint graph`}>
    <polygon className="counter-occlusion-debug" points={counterOcclusionOutline.map(point => point.join(',')).join(' ')} />
    {sceneWaypointEdges.map(edge => <polyline key={edge.join('-')} points={edge.map(coordinates).join(' ')} className="route-edge" />)}
    {route.length > 0 && <polyline points={[movement.routeFrom, ...route].filter(id => sceneWaypoints[id]).map(coordinates).join(' ')} className="resolved-route" />}
    {sceneWaypoints[movement?.segmentFrom] && sceneWaypoints[movement?.segmentTo] && <polyline
      points={[movement.segmentFrom, movement.segmentTo].map(coordinates).join(' ')} className="current-segment" />}
    {Object.values(sceneWaypoints).map(point => <g key={point.id} transform={`translate(${point.x * scene.width / 100},${point.y * scene.height / 100})`}>
      <circle r="5" /><text x="8" y={point.id === 'counter_exit' ? 18 : -10}>{point.id}</text>
    </g>)}
  </svg>
}
