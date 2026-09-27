import { useCatMicroBehavior } from '../hooks/useCatMicroBehavior.js'
import { catMicroVisuals } from '../data/catMicroVisuals.js'
import { CAT_MOVEMENT, getCatPose, getCatWalkingVisual } from '../data/catVisuals.js'
import { useLoadedSprite } from '../hooks/useLoadedSprite.js'

export default function CatSprite({ visual, movement, activity, microBlocked = true }) {
  const { direction, phase, segmentFrom, segmentTo, destination } = movement
  const microPose = useCatMicroBehavior(activity, phase, microBlocked)
  const micro = catMicroVisuals[microPose]
  const requestedWalk = getCatWalkingVisual(direction)
  const walking = phase === 'walking'
  const resting = { kind: 'idle', src: getCatPose(activity) }
  const loaded = useLoadedSprite(walking && requestedWalk
    ? { kind: 'walk', src: requestedWalk.src, walk: requestedWalk } : micro ? { kind: 'micro', src: micro.src, pose: microPose, crop: micro } : resting,
    { kind: 'idle', src: visual.src })
  const displayed = loaded.kind === 'micro' && (walking || loaded.pose !== microPose)
    ? { kind: 'idle', src: visual.src } : loaded
  const walk = displayed.kind === 'walk' ? displayed.walk : requestedWalk
  return <span className="walking-visual cat-visual" data-phase={phase} data-render-mode={displayed.kind}
    data-direction={direction || 'idle'} data-segment-from={segmentFrom}
    data-waypoint={segmentTo} data-destination={destination}
    data-pose={walking ? 'walking' : displayed.kind === 'micro' ? displayed.pose : activity || 'sleeping'}>
    {/* All activity poses and walk cells use the same canvas and ground line. */}
    <img className="npc-sprite" src={displayed.kind === 'idle' ? displayed.src : resting.src} width={visual.width} height={visual.height}
      alt="" aria-hidden="true" draggable="false" />
    {displayed.kind === 'micro' && <span className="cat-micro" aria-hidden="true">
      <img src={displayed.src} alt="" draggable="false" style={{ width: displayed.crop.width, left: displayed.crop.left, top: displayed.crop.top }} />
    </span>}
    {(walking || displayed.kind === 'walk') && walk && <span className="cat-walk" aria-hidden="true"
      style={{ '--cat-cycle': `${1000 / CAT_MOVEMENT.fps * CAT_MOVEMENT.frames}ms`,
        '--cat-mirror': walk.mirrored ? -1 : 1 }}>
      <img src={walk.src} alt="" draggable="false" />
    </span>}
  </span>
}
