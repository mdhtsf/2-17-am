import KaiSprite from './KaiSprite.jsx'
import { useEffect, useRef } from 'react'
import { useNpcMovement } from '../hooks/useNpcMovement.js'

// One entity owns the sprite, label and hit area so they share every transition.
export default function NPC({ npc, visual, anchor, selected, onSelect, currentActivity, logicalLocation, onMovementChange }) {
  const { id, name } = npc
  const entityRef = useRef(null)
  const movement = useNpcMovement(anchor, entityRef, id === 'kai', logicalLocation)
  useEffect(() => { if (id === 'kai') onMovementChange?.(movement) }, [id, movement, onMovementChange])
  return <button
    ref={entityRef}
    className={`npc npc-${id} ${selected ? 'selected' : ''}`}
    data-activity={currentActivity}
    data-location={logicalLocation}
    style={{
      // Kai's hook applies this same derived target after sampling an interrupted
      // CSS transition. Other NPCs retain their original declarative movement.
      ...(id === 'kai' ? {} : { left: `${anchor.x}%`, top: `${anchor.y}%`, '--npc-scale': anchor.scale, zIndex: anchor.zIndex }),
      width: `${visual.sceneWidth}%`,
    }}
    onClick={onSelect}
    aria-label={id === 'cat' ? '摸摸猫' : `与 ${name} 对话`}
    aria-pressed={selected}
  >
    {id === 'kai' && <span className="kai-ground-shadow" aria-hidden="true" />}
    {id === 'kai' ? <KaiSprite visual={visual} movement={movement} />
      : <img className="npc-sprite" src={visual.src} width={visual.width} height={visual.height} alt="" aria-hidden="true" draggable="false" />}
    <span className="npc-indicator" aria-hidden="true">···</span>
    <span className="npc-label" aria-hidden="true">{name}<small>{selected ? '▾' : '·'}</small></span>
    <span className="hotspot-marker" aria-hidden="true" />
  </button>
}
