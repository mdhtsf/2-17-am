import { npcs } from '../../shared/npcs.js'

// Art-space coordinates, independent of dialogue data and viewport size.
// Rectangles use percentages of the complete image, not the visible crop.
export const scene = {
  src: '/assets/scenes/after-hours.png',
  width: 1536,
  height: 1024,
  description: '雨夜的像素风便利店：凯在暖光收银台后，米拉站在冷柜旁，猫趴在地砖过道上。临街玻璃映着雨水和城市灯光。',
  hotspots: [
    { id: 'kai', name: npcs.kai.name, x: 25.65, y: 29.88, width: 5.21, height: 13.96 },
    { id: 'mira', name: npcs.mira.name, x: 55.34, y: 31.74, width: 6.25, height: 22.27 },
    { id: 'cat', name: 'THE CAT', x: 29.62, y: 58, width: 6.32, height: 5.96 },
  ],
  rainRegions: [
    'polygon(45.5% 0, 100% 0, 100% 38%, 45.5% 7%)',
    'polygon(88.5% 40%, 100% 45%, 100% 77%, 88.5% 67%)',
  ],
}
