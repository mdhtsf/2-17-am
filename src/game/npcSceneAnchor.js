import { npcSceneAnchors } from '../data/npcSceneAnchors.js'

export function getNpcSceneAnchor(npcId, logicalLocation) {
  if (typeof npcId !== 'string' || !Object.hasOwn(npcSceneAnchors, npcId)) throw new RangeError('Unknown scene NPC')
  const anchors = npcSceneAnchors[npcId]
  if (typeof logicalLocation !== 'string' || !Object.hasOwn(anchors, logicalLocation)) throw new RangeError('Invalid NPC scene location')
  return anchors[logicalLocation]
}
