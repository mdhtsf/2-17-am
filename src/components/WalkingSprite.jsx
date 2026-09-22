import { HUMAN_MOVEMENT, WALK_FRAME_MS, WALK_CYCLE_MS } from '../game/npcMovement.js'
import { getActivityVisual } from '../data/npcActivityVisuals.js'
import ActivitySprite from './ActivitySprite.jsx'

export default function WalkingSprite({ visual, movement, getWalkingVisual, npcId, registration, activity }) {
  const { direction, phase, segmentTo, segmentFrom, destination } = movement
  const walk = getWalkingVisual(direction)
  const pose = getActivityVisual(npcId, activity)
  return <span className={`walking-visual ${npcId}-visual`} data-activity-pose={pose ? activity : undefined} data-direction={direction || 'idle'} data-phase={phase} data-waypoint={segmentTo} data-segment-from={segmentFrom} data-destination={destination}
    style={{ '--walk-cycle': `${WALK_CYCLE_MS}ms`, '--walk-settle': `${HUMAN_MOVEMENT.settleMs}ms`,
      '--walk-visible-height': registration?.visibleHeight, '--walk-bottom': registration?.bottom }}>
    {/* The idle canvas reserves the same entity/label/hitbox geometry in every phase. */}
    <img className="npc-sprite" src={visual.src} width={visual.width} height={visual.height}
      alt="" aria-hidden="true" draggable="false" />
    {pose && <ActivitySprite pose={pose} visual={visual} activity={activity} />}
    {walk && <span className={`walking-sprite ${npcId}-walk`} aria-hidden="true"
      style={{ '--walk-mirror': walk.mirrored ? -1 : 1 }}>
      {walk.centers.map((center, index) => <span className={`walking-frame ${npcId}-walk-frame`} key={index}
        style={{ animationDelay: `${-((HUMAN_MOVEMENT.frames - index) % HUMAN_MOVEMENT.frames) * WALK_FRAME_MS}ms` }}>
        <img src={walk.src} alt="" draggable="false" style={{
          width: `${400 * 720 / walk.height}%`,
          left: `${(256 - (center + index * 512) * 720 / walk.height) / 512 * 100}%`,
          top: `${-(walk.bottoms[index] - walk.height) / walk.height * 100}%`,
        }} />
      </span>)}
    </span>}
  </span>
}
