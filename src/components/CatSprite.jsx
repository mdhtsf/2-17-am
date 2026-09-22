import { CAT_MOVEMENT, getCatPose, getCatWalkingVisual } from '../data/catVisuals.js'
import { useLoadedSprite } from '../hooks/useLoadedSprite.js'

export default function CatSprite({ visual, movement, activity }) {
  const { direction, phase, segmentFrom, segmentTo, destination } = movement
  const requestedWalk = getCatWalkingVisual(direction)
  const walking = phase === 'walking'
  const resting = { kind: 'idle', src: getCatPose(activity) }
  const displayed = useLoadedSprite(walking && requestedWalk
    ? { kind: 'walk', src: requestedWalk.src, walk: requestedWalk } : resting,
    { kind: 'idle', src: visual.src })
  const walk = displayed.kind === 'walk' ? displayed.walk : requestedWalk
  return <span className="walking-visual cat-visual" data-phase={phase} data-render-mode={displayed.kind}
    data-direction={direction || 'idle'} data-segment-from={segmentFrom}
    data-waypoint={segmentTo} data-destination={destination}
    data-pose={walking ? 'walking' : activity || 'sleeping'}>
    {/* All activity poses and walk cells use the same canvas and ground line. */}
    <img className="npc-sprite" src={displayed.kind === 'idle' ? displayed.src : resting.src} width={visual.width} height={visual.height}
      alt="" aria-hidden="true" draggable="false" />
    {(walking || displayed.kind === 'walk') && walk && <span className="cat-walk" aria-hidden="true"
      style={{ '--cat-cycle': `${1000 / CAT_MOVEMENT.fps * CAT_MOVEMENT.frames}ms`,
        '--cat-mirror': walk.mirrored ? -1 : 1 }}>
      <img src={walk.src} alt="" draggable="false" />
    </span>}
  </span>
}
