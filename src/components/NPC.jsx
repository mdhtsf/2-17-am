// One entity owns the sprite, label and hit area so they share every transition.
export default function NPC({ npc, visual, anchor, selected, onSelect, currentActivity, logicalLocation }) {
  const { id, name } = npc
  return <button
    className={`npc npc-${id} ${selected ? 'selected' : ''}`}
    data-activity={currentActivity}
    data-location={logicalLocation}
    style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, width: `${visual.sceneWidth}%`, '--npc-scale': anchor.scale, zIndex: anchor.zIndex }}
    onClick={onSelect}
    aria-label={id === 'cat' ? '摸摸猫' : `与 ${name} 对话`}
    aria-pressed={selected}
  >
    <img className="npc-sprite" src={visual.src} width={visual.width} height={visual.height} alt="" aria-hidden="true" draggable="false" />
    <span className="npc-indicator" aria-hidden="true">···</span>
    <span className="npc-label" aria-hidden="true">{name}<small>{selected ? '▾' : '·'}</small></span>
    <span className="hotspot-marker" aria-hidden="true" />
  </button>
}
