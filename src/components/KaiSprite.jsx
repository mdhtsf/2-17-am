import WalkingSprite from './WalkingSprite.jsx'
import { getKaiWalkingVisual } from '../data/kaiWalking.js'

// Preserve Kai's accepted visual contract while sharing the frame renderer.
export default function KaiSprite(props) {
  return <WalkingSprite {...props} npcId="kai" getWalkingVisual={getKaiWalkingVisual} />
}
