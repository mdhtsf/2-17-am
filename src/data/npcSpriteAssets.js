import { npcVisuals } from './npcVisuals.js'
import { npcActivityVisuals } from './npcActivityVisuals.js'
import { getKaiWalkingVisual } from './kaiWalking.js'
import { getMiraWalkingVisual } from './miraWalking.js'
import { catPoses, getCatWalkingVisual } from './catVisuals.js'

export const npcSpriteAssets = Object.freeze([...new Set([
  ...Object.values(npcVisuals).map(visual => visual.src),
  ...Object.values(npcActivityVisuals).flatMap(poses => Object.values(poses).filter(Boolean).map(pose => pose.src)),
  ...Object.values(catPoses),
  ...[getKaiWalkingVisual, getMiraWalkingVisual, getCatWalkingVisual].flatMap(getVisual =>
    ['right', 'front', 'back'].map(direction => getVisual(direction).src)),
])])
