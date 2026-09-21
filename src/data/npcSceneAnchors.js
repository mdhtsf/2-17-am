import { getKaiSceneDepth } from '../game/sceneDepth.js'

// Bottom-center anchors in percentages of the full 1536 × 1024 scene, before cropping.
// Kai can stand behind the counter foreground (layer 2); other destinations are in front.
export const npcSceneAnchors = Object.freeze({
  kai: Object.freeze({
    counter: Object.freeze({ x: 28.2, y: 54.5, ...getKaiSceneDepth({ y: 54.5, zone: 'counter' }) }),
    coffee_station: Object.freeze({ x: 23, y: 52, ...getKaiSceneDepth({ y: 52, zone: 'counter' }) }),
    shelf: Object.freeze({ x: 52, y: 45.5, ...getKaiSceneDepth({ y: 45.5 }) }),
    window: Object.freeze({ x: 88, y: 79, ...getKaiSceneDepth({ y: 79 }) }),
  }),
  mira: Object.freeze({
    notes_spot: Object.freeze({ x: 58.6, y: 55, scale: 1, zIndex: 3 }),
    fridge: Object.freeze({ x: 64.8, y: 57, scale: 0.97, zIndex: 3 }),
    drink_area: Object.freeze({ x: 68, y: 59, scale: 1, zIndex: 3 }),
    window: Object.freeze({ x: 75.5, y: 72.5, scale: 1, zIndex: 4 }),
  }),
  cat: Object.freeze({
    floor: Object.freeze({ x: 32.8, y: 64.5, scale: 1, zIndex: 4 }),
    shelf_corner: Object.freeze({ x: 39.5, y: 68, scale: 0.95, zIndex: 4 }),
    door: Object.freeze({ x: 83, y: 80, scale: 1.05, zIndex: 5 }),
    aisle: Object.freeze({ x: 39, y: 59, scale: 0.85, zIndex: 3 }),
  }),
})
