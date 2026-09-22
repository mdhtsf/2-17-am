import CatSprite from './CatSprite.jsx'
import { CAT_MOVEMENT, catVisual } from '../data/catVisuals.js'
import KaiSprite from './KaiSprite.jsx'
import WalkingSprite from './WalkingSprite.jsx'
import { getMiraWalkingVisual, miraWalkingRegistration } from '../data/miraWalking.js'
import { useEffect, useRef } from 'react'
import { useNpcMovement } from '../hooks/useNpcMovement.js'

// One entity owns the sprite, label and hit area so they share every transition.
export default function NPC({ npc, visual, anchor, selected, onSelect, currentActivity, logicalLocation, onMovementChange }) {
  const { id, name } = npc
  const entityRef = useRef(null)
  const movement = useNpcMovement(anchor, entityRef, true, logicalLocation, id, id === 'cat' ? CAT_MOVEMENT : undefined)
  // Also acknowledge a new activity at the same spot (no walking state change).
  useEffect(() => { onMovementChange?.(movement) }, [movement, currentActivity, onMovementChange])
  return <button
    ref={entityRef}
    className={`npc npc-${id} ${selected ? 'selected' : ''}`}
    data-activity={currentActivity}
    data-location={logicalLocation}
    style={{
      width: `${visual.sceneWidth}%`,
    }}
    onClick={onSelect}
    aria-label={id === 'cat' ? '摸摸猫' : `与 ${name} 对话`}
    aria-pressed={selected}
  >
    <span className={`npc-ground-shadow ${id}-ground-shadow`} style={id === 'cat' ? { width: catVisual.shadowWidth } : undefined} aria-hidden="true" />
    {id === 'kai' ? <KaiSprite visual={visual} movement={movement} activity={currentActivity} />
      : id === 'mira' ? <WalkingSprite visual={visual} movement={movement} npcId="mira"
          getWalkingVisual={getMiraWalkingVisual} registration={miraWalkingRegistration} activity={currentActivity} />
      : <CatSprite visual={visual} movement={movement} activity={currentActivity} />}
    <span className="npc-indicator" aria-hidden="true">···</span>
    <span className="npc-label" aria-hidden="true">{name}<small>{selected ? '▾' : '·'}</small></span>
    <span className="hotspot-marker" aria-hidden="true" />
  </button>
}
