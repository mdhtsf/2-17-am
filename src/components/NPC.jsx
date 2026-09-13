// NPC is now a semantic, transparent hotspot. The character is painted in the art.
export default function NPC({ hotspot, selected, onSelect }) {
  const { id, name, x, y, width, height } = hotspot
  return <button
    className={`npc npc-${id} ${selected ? 'selected' : ''}`}
    style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` }}
    onClick={onSelect}
    aria-label={id === 'cat' ? '摸摸猫' : `与 ${name} 对话`}
    aria-pressed={selected}
  >
    <span className="npc-indicator" aria-hidden="true">···</span>
    <span className="npc-label" aria-hidden="true">{name}<small>{selected ? '▾' : '·'}</small></span>
    <span className="hotspot-marker" aria-hidden="true" />
  </button>
}
