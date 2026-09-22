// Shared human depth curve, preserving Kai's accepted .92–1.06 calibration.
// Cat retains its independent anchor scales.
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
