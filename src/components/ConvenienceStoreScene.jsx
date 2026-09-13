import NPC from './NPC'
import SceneBackground from './SceneBackground'
import RainOverlay from './RainOverlay'
import { scene } from '../data/scene'

export default function ConvenienceStoreScene({ selectedId, onSelect, catActive, onCat }) {
  return <section
    className="scene"
    style={{ '--scene-aspect': scene.width / scene.height }}
    aria-label="雨夜便利店"
  >
    <SceneBackground scene={scene} />
    {scene.rainRegions.map(mask => <RainOverlay key={mask} mask={mask} />)}
    <div className="npc-overlay">
      {scene.hotspots.map(hotspot => (
        <NPC
          key={hotspot.id}
          hotspot={hotspot}
          selected={hotspot.id === 'cat' ? catActive : selectedId === hotspot.id}
          onSelect={hotspot.id === 'cat' ? onCat : () => onSelect(hotspot.id)}
        />
      ))}
    </div>
    <div className="scene-vignette" aria-hidden="true" />
  </section>
}
