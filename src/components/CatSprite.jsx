import { CAT_MOVEMENT, getCatPose, getCatWalkingVisual } from '../data/catVisuals.js'

export default function CatSprite({ visual, movement, activity }) {
  const { direction, phase, segmentFrom, segmentTo, destination } = movement
  const walk = getCatWalkingVisual(direction)
  const walking = phase === 'walking'
  return <span className="walking-visual cat-visual" data-phase={phase}
    data-direction={direction || 'idle'} data-segment-from={segmentFrom}
    data-waypoint={segmentTo} data-destination={destination}
    data-pose={walking ? 'walking' : activity || 'sleeping'}>
    {/* All activity poses and walk cells use the same canvas and ground line. */}
    <img className="npc-sprite" src={getCatPose(activity)} width={visual.width} height={visual.height}
      alt="" aria-hidden="true" draggable="false" />
    {walking && walk && <span className="cat-walk" aria-hidden="true"
      style={{ '--cat-cycle': `${1000 / CAT_MOVEMENT.fps * CAT_MOVEMENT.frames}ms`,
        '--cat-mirror': walk.mirrored ? -1 : 1 }}>
      <img src={walk.src} alt="" draggable="false" />
    </span>}
  </span>
}
