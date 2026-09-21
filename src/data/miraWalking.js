// Four 512×768 cells per sheet. Shared playback, character-specific artwork.
const sheets = Object.freeze(Object.fromEntries(['side', 'front', 'back'].map(direction => [direction,
  Object.freeze({ height: 720, centers: Object.freeze([256, 256, 256, 256]), bottoms: Object.freeze([736, 736, 736, 736]) }),
])))

export function getMiraWalkingVisual(direction) {
  const sheet = direction === 'left' || direction === 'right' ? 'side' : direction
  if (!Object.hasOwn(sheets, sheet)) return null
  return { ...sheets[sheet], src: `/assets/npcs/mira/mira-walk-${sheet}.png`, mirrored: direction === 'left' }
}

export const miraWalkingRegistration = Object.freeze({
  visibleHeight: `${860 / 911 * 100}%`, bottom: `${26 / 911 * 100}%`,
})
