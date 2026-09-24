import { getKaiSceneDepth, getHumanSceneDepth, getCatSceneDepth } from '../game/sceneDepth.js'

// Bottom-center anchors in percentages of the full 1536 × 1024 scene, before cropping.
// Kai's hidden foot positions remain behind the scene-level counter foreground.
export const npcSceneAnchors = Object.freeze({
  kai: Object.freeze({
    counter: Object.freeze({ x: 28.2, y: 54.5, ...getKaiSceneDepth({ y: 54.5, zone: 'counter' }) }),
    coffee_station: Object.freeze({ x: 23, y: 52, ...getKaiSceneDepth({ y: 52, zone: 'counter' }) }),
    shelf: Object.freeze({ x: 52, y: 45.5, ...getKaiSceneDepth({ y: 45.5 }) }),
    window: Object.freeze({ x: 88, y: 79, ...getKaiSceneDepth({ y: 79 }) }),
  }),
  mira: Object.freeze({
    // Reuse the existing public counter opening, without adding graph edges.
    counter_chat: Object.freeze({ x: 51.5, y: 45.5, ...getHumanSceneDepth({ y: 45.5 }) }),
    notes_spot: Object.freeze({ x: 58.6, y: 55, ...getHumanSceneDepth({ y: 55 }) }),
    fridge: Object.freeze({ x: 64.8, y: 57, ...getHumanSceneDepth({ y: 57 }) }),
    drink_area: Object.freeze({ x: 68, y: 59, ...getHumanSceneDepth({ y: 59 }) }),
    window: Object.freeze({ x: 75.5, y: 72.5, ...getHumanSceneDepth({ y: 72.5 }) }),
  }),
  cat: Object.freeze({
    floor: Object.freeze({ x: 32.8, y: 64.5, ...getCatSceneDepth({ y: 64.5 }) }),
    shelf_corner: Object.freeze({ x: 39.5, y: 65, ...getCatSceneDepth({ y: 65 }) }),
    door: Object.freeze({ x: 83, y: 80, ...getCatSceneDepth({ y: 80 }) }),
    aisle: Object.freeze({ x: 39, y: 59, ...getCatSceneDepth({ y: 59 }) }),
  }),
})
