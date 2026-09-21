// Intrinsic dimensions preserve the provided PNGs; width is a percentage of scene width.
// Shared size adjustment; per-location perspective scales and foot anchors stay unchanged.
const NPC_BASE_VISUAL_SCALE = 0.9

export const npcVisuals = Object.freeze({
  kai: Object.freeze({ src: '/assets/npcs/kai.png', width: 351, height: 988, sceneWidth: 6 * NPC_BASE_VISUAL_SCALE }),
  mira: Object.freeze({ src: '/assets/npcs/mira.png', width: 401, height: 911, sceneWidth: 6.4 * NPC_BASE_VISUAL_SCALE }),
  cat: Object.freeze({ src: '/assets/npcs/cat.png', width: 372, height: 232, sceneWidth: 6.8 * NPC_BASE_VISUAL_SCALE }),
})
