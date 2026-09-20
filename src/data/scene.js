import { npcs } from '../../shared/npcs.js'

// Background framing and entity identities. Moving anchors live in npcSceneAnchors.js.
export const scene = {
  src: '/assets/scenes/after-hours-clean.png',
  width: 1536,
  height: 1024,
  description: '雨夜的像素风便利店：暖光收银台、冷柜与货架。临街玻璃映着雨水和城市灯光。',
  npcs: [
    { id: 'kai', name: npcs.kai.name },
    { id: 'mira', name: npcs.mira.name },
    { id: 'cat', name: 'THE CAT' },
  ],
  // Reuse the untouched clean image for foreground occlusion, never baked character art.
  counterOcclusion: 'polygon(17% 44.8%, 44.5% 33%, 46.8% 37.8%, 47.7% 48.3%, 19.4% 61.2%, 16.8% 58%)',
  rainRegions: [
    'polygon(45.5% 0, 100% 0, 100% 38%, 45.5% 7%)',
    'polygon(88.5% 40%, 100% 45%, 100% 77%, 88.5% 67%)',
  ],
}
