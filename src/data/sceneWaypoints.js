import { npcSceneAnchors } from './npcSceneAnchors.js'
import { getKaiSceneDepth } from '../game/sceneDepth.js'

// Hand-authored foot/ground coordinates on the unchanged 1536 × 1024 artwork.
// Counter nodes are behind its existing foreground cutout, not public aisles.
const point = (id, x, y, zone = 'floor') => Object.freeze({ id, x, y, zone, ...getKaiSceneDepth({ y, zone }) })
const destination = (id, zone = 'floor') => point(id, npcSceneAnchors.kai[id].x, npcSceneAnchors.kai[id].y, zone)
export const sceneWaypoints = Object.freeze({
  counter: destination('counter', 'counter'),
  coffee_station: destination('coffee_station', 'counter'),
  counter_lane: point('counter_lane', 43, 48, 'counter'),
  counter_exit: point('counter_exit', 49.5, 45.5),
  shelf: destination('shelf'),
  fridge_front: point('fridge_front', 62, 54),
  window_lane: point('window_lane', 72, 67),
  door_lane: point('door_lane', 81, 75),
  window: destination('window'),
})

// Only these undirected corridor segments are walkable. No general-space search.
export const sceneWaypointEdges = Object.freeze([
  ['coffee_station', 'counter'], ['counter', 'counter_lane'],
  ['counter_lane', 'counter_exit'], ['counter_exit', 'shelf'],
  ['shelf', 'fridge_front'], ['fridge_front', 'window_lane'],
  ['window_lane', 'door_lane'], ['door_lane', 'window'],
].map(edge => Object.freeze(edge)))

// A registry of actual reusable foreground layers, not imaginary z-index masks.
// More masks can be registered here when the artwork supports them.
export const sceneForegroundLayers = Object.freeze([
  Object.freeze({ id: 'counter', zIndex: 2, mask: 'counterOcclusion' }),
])
