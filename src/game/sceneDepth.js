// Shared human depth curve, preserving Kai's accepted .92–1.06 calibration.
// Cat uses its own small-body perspective curve below.
export function getHumanSceneDepth({ y, zone = 'floor' }) {
  if (!Number.isFinite(y) || !['counter', 'floor'].includes(zone)) throw new RangeError('Invalid scene depth')
  const depth = Math.max(0, Math.min(1, (y - 45.5) / (79 - 45.5)))
  return {
    scale: Number((0.92 + depth * 0.14).toFixed(4)),
    zIndex: zone === 'counter' ? 1 : y < 60 ? 3 : y < 74 ? 4 : 5,
  }
}

// Compatibility for the accepted Kai configuration and regression fixtures.
export const getKaiSceneDepth = getHumanSceneDepth

// Local ordering among NPCs only. The scene-level foreground separately masks
// overlapping pixels throughout entry/exit, regardless of this local depth.
export function getSegmentLayer(from, to) {
  return from.zone === 'counter' || to.zone === 'counter' ? 1 : getHumanSceneDepth(from).zIndex
}

// Preserve Cat's resting scale (1) and near-door scale (1.05). No human tuning.
export function getCatSceneDepth({ y }) {
  if (!Number.isFinite(y)) throw new RangeError('Invalid Cat depth')
  const scale = y < 64.5 ? .85 + Math.max(0, (y - 59) / 5.5) * .15
    : 1 + Math.min(1, (y - 64.5) / 15.5) * .05
  return { scale: Number(scale.toFixed(4)), zIndex: y < 60 ? 3 : y < 74 ? 4 : 5 }
}
