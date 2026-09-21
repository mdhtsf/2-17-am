import { getKaiWalkingVisual } from '../data/kaiWalking.js'
import { KAI_MOVEMENT, WALK_FRAME_MS, WALK_CYCLE_MS } from '../game/npcMovement.js'

export default function KaiSprite({ visual, movement }) {
  const { direction, phase, segmentTo, segmentFrom, destination } = movement
  const walk = getKaiWalkingVisual(direction)
  return <span className="kai-visual" data-direction={direction || 'idle'} data-phase={phase} data-waypoint={segmentTo} data-segment-from={segmentFrom} data-destination={destination}
    style={{ '--walk-cycle': `${WALK_CYCLE_MS}ms`, '--walk-settle': `${KAI_MOVEMENT.settleMs}ms` }}>
    {/* The idle canvas reserves the same entity/label/hitbox geometry in every phase. */}
    <img className="npc-sprite" src={visual.src} width={visual.width} height={visual.height}
      alt="" aria-hidden="true" draggable="false" />
    {walk && <span className="kai-walk" aria-hidden="true"
      style={{ '--walk-mirror': walk.mirrored ? -1 : 1 }}>
      {walk.centers.map((center, index) => <span className="kai-walk-frame" key={index}
        style={{ animationDelay: `${-((KAI_MOVEMENT.frames - index) % KAI_MOVEMENT.frames) * WALK_FRAME_MS}ms` }}>
        <img src={walk.src} alt="" draggable="false" style={{
          width: `${400 * 720 / walk.height}%`,
          left: `${(256 - (center + index * 512) * 720 / walk.height) / 512 * 100}%`,
          top: `${-(walk.bottoms[index] - walk.height) / walk.height * 100}%`,
        }} />
      </span>)}
    </span>}
  </span>
}
