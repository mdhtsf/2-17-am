// Stage 4.2C-3: source-scene-faithful artwork, exported as four 512 × 768 cells.
// All poses share a 720 px visible height and y=736 foot baseline.
// Asset correction only: direction, route, cadence and world scale stay unchanged.
const sheets = {
  side: { height: 720, centers: [256, 256, 256, 256], bottoms: [736, 736, 736, 736] },
  front: { height: 720, centers: [256, 256, 256, 256], bottoms: [736, 736, 736, 736] },
  back: { height: 720, centers: [256, 256, 256, 256], bottoms: [736, 736, 736, 736] },
}

export function getKaiWalkingVisual(direction) {
  const sheet = direction === 'left' || direction === 'right' ? 'side' : direction
  if (!Object.hasOwn(sheets, sheet)) return null
  return { ...sheets[sheet], src: `/assets/npcs/kai/kai-walk-${sheet}.png`, mirrored: direction === 'left' }
}
