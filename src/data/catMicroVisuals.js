// Two generated poses referenced from the approved calico cat, registered to the
// existing 224x192 canvas. Art is kept intact; CSS crops the transparent atlas.
export const catMicroSheet = '/assets/npcs/cat/cat-micro-poses.png'
const scale = 158 / 688
export const catMicroVisuals = Object.freeze(Object.fromEntries(
  [['yawning', 453.5], ['scratching', 1421.5]].map(([pose, center]) => [pose, Object.freeze({
    src: catMicroSheet,
    width: `${1914 * scale / 224 * 100}%`,
    left: `${(112 - center * scale) / 224 * 100}%`,
    top: `${(192 - 773 * scale) / 192 * 100}%`,
  })])))
