import KaiSprite from './KaiSprite.jsx'
import WalkingSprite from './WalkingSprite.jsx'
import { getMiraWalkingVisual, miraWalkingRegistration } from '../data/miraWalking.js'
import { useEffect, useRef } from 'react'
import { useNpcMovement } from '../hooks/useNpcMovement.js'

// One entity owns the sprite, label and hit area so they share every transition.
export default function NPC({ npc, visual, anchor, selected, onSelect, currentActivity, logicalLocation, onMovementChange }) {
  const { id, name } = npc
  const entityRef = useRef(null)
  const human = id === 'kai' || id === 'mira'
  const movement = useNpcMovement(anchor, entityRef, human, logicalLocation, id)
  useEffect(() => { if (human) onMovementChange?.(movement) }, [human, movement, onMovementChange])
  return <button
    ref={entityRef}
    className={`npc npc-${id} ${selected ? 'selected' : ''}`}
    data-activity={currentActivity}
    data-location={logicalLocation}
    style={{
      // Human movement owns interrupted CSS transitions; Cat stays declarative.
      ...(human ? {} : { left: `${anchor.x}%`, top: `${anchor.y}%`, '--npc-scale': anchor.scale, zIndex: anchor.zIndex }),
      width: `${visual.sceneWidth}%`,
    }}
    onClick={onSelect}
    aria-label={id === 'cat' ? '摸摸猫' : `与 ${name} 对话`}
    aria-pressed={selected}
  >
    {human && <span className={`npc-ground-shadow ${id}-ground-shadow`} aria-hidden="true" />}
    {id === 'kai' ? <KaiSprite visual={visual} movement={movement} />
      : id === 'mira' ? <WalkingSprite visual={visual} movement={movement} npcId="mira"
          getWalkingVisual={getMiraWalkingVisual} registration={miraWalkingRegistration} />
      : <img className="npc-sprite" src={visual.src} width={visual.width} height={visual.height} alt="" aria-hidden="true" draggable="false" />}
    <span className="npc-indicator" aria-hidden="true">···</span>
    <span className="npc-label" aria-hidden="true">{name}<small>{selected ? '▾' : '·'}</small></span>
    <span className="hotspot-marker" aria-hidden="true" />
  </button>
}
