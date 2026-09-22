// Quadruped art and cadence are independent of the accepted human sprite system.
export const CAT_MOVEMENT = Object.freeze({
  pixelsPerSecond: 125, minDurationMs: 500, maxDurationMs: 8000,
  frames: 4, fps: 8, settleMs: 125, completionGraceMs: 80,
})

export const catPoses = Object.freeze({
  sleeping: '/assets/npcs/cat/cat-sleeping.png',
  grooming: '/assets/npcs/cat/cat-grooming.png',
  watching_door: '/assets/npcs/cat/cat-watching.png',
  wandering: '/assets/npcs/cat/cat-idle.png',
})

export const catVisual = Object.freeze({
  src: catPoses.sleeping, width: 224, height: 192,
  // Sleeping silhouette is 186px wide; preserve the accepted visible 6.12%.
  sceneWidth: 6.12 * 224 / 186,
  groundAnchor: Object.freeze({ x: .5, y: 1 }), shadowWidth: '64%',
})

export function getCatWalkingVisual(direction) {
  const sheet = direction === 'left' || direction === 'right' ? 'side' : direction
  if (!['side', 'front', 'back'].includes(sheet)) return null
  return { src: `/assets/npcs/cat/cat-walk-${sheet}.png`, mirrored: direction === 'left' }
}

export function getCatPose(activity = 'sleeping') {
  return catPoses[activity] || catPoses.sleeping
}
