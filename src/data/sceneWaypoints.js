import { npcSceneAnchors } from './npcSceneAnchors.js'
import { getKaiSceneDepth, getCatSceneDepth } from '../game/sceneDepth.js'

// Hand-authored foot/ground coordinates on the unchanged 1536 × 1024 artwork.
// Counter nodes are behind its existing foreground cutout, not public aisles.
const point = (id, x, y, zone = 'floor') => Object.freeze({ id, x, y, zone, ...getKaiSceneDepth({ y, zone }) })
const destination = (id, zone = 'floor') => point(id, npcSceneAnchors.kai[id].x, npcSceneAnchors.kai[id].y, zone)
const miraDestination = id => point(`mira_${id}`, npcSceneAnchors.mira[id].x, npcSceneAnchors.mira[id].y)
const catPoint = (id, x, y) => Object.freeze({ id, x, y, zone: 'floor', ...getCatSceneDepth({ y }) })
const catDestination = id => Object.freeze({ id: `cat_${id}`, zone: 'floor', ...npcSceneAnchors.cat[id] })
export const sceneWaypoints = Object.freeze({
  counter: destination('counter', 'counter'),
  coffee_station: destination('coffee_station', 'counter'),
  counter_lane: point('counter_lane', 43, 48, 'counter'),
  // Clear the x=730 counter end with the widest accepted walking pose, not just
  // the foot center. Same opening/graph; 30.72 art px farther right than before.
  counter_exit: point('counter_exit', 51.5, 45.5),
  shelf: destination('shelf'),
  fridge_front: point('fridge_front', 62, 54),
  window_lane: point('window_lane', 72, 67),
  door_lane: point('door_lane', 81, 75),
  window: destination('window'),
  mira_notes_spot: miraDestination('notes_spot'),
  mira_fridge: miraDestination('fridge'),
  mira_drink_area: miraDestination('drink_area'),
  mira_window: miraDestination('window'),
  cat_floor: catDestination('floor'),
  cat_shelf_corner: catDestination('shelf_corner'),
  cat_aisle: catDestination('aisle'),
  cat_door: catDestination('door'),
  // The low floor lane between the two shelf rows, then around their front end.
  cat_front_lane: catPoint('cat_front_lane', 62, 87.5),
  cat_outer_lane: catPoint('cat_outer_lane', 70, 85),
})

// Only these undirected corridor segments are walkable. No general-space search.
export const sceneWaypointEdges = Object.freeze([
  ['coffee_station', 'counter'], ['counter', 'counter_lane'],
  ['counter_lane', 'counter_exit'], ['counter_exit', 'shelf'],
  ['shelf', 'fridge_front'], ['fridge_front', 'window_lane'],
  ['window_lane', 'door_lane'], ['door_lane', 'window'],
  // Leaf connections preserve every accepted Kai route (no new shortcuts).
  ['mira_notes_spot', 'fridge_front'], ['mira_fridge', 'fridge_front'],
  ['mira_drink_area', 'fridge_front'], ['mira_window', 'window_lane'],
  // One attachment to the shared graph: no shortcuts change human routes.
  ['cat_aisle', 'cat_floor'], ['cat_floor', 'cat_shelf_corner'],
  ['cat_shelf_corner', 'cat_front_lane'], ['cat_front_lane', 'cat_outer_lane'],
  ['cat_outer_lane', 'cat_door'], ['cat_door', 'door_lane'],
].map(edge => Object.freeze(edge)))

// NPC-local names can overlap: Mira's window is not Kai's window.
export function getNpcWaypoint(npcId, location) {
  if (!['kai', 'mira', 'cat'].includes(npcId) || !Object.hasOwn(npcSceneAnchors[npcId], location)) {
    throw new RangeError('Unknown NPC destination')
  }
  if (npcId === 'mira' && location === 'counter_chat') return 'counter_exit'
  return npcId === 'kai' ? location : `${npcId}_${location}`
}

// A registry of actual reusable foreground layers, not imaginary z-index masks.
// More masks can be registered here when the artwork supports them.
export const sceneForegroundLayers = Object.freeze([
  Object.freeze({ id: 'counter', zIndex: 6, mask: 'counterOcclusion' }),
  Object.freeze({ id: 'merchandise-shelf', zIndex: 6, mask: 'shelfOcclusion' }),
])
