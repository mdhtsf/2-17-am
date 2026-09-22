import SceneForeground from './SceneForeground.jsx'
import NPC from './NPC'
import SceneBackground from './SceneBackground'
import RainOverlay from './RainOverlay'
import { scene } from '../data/scene'
import { getNpcSceneLocation } from '../game/npcSceneLocation.js'
import { getNpcSceneAnchor } from '../game/npcSceneAnchor.js'
import { npcVisuals } from '../data/npcVisuals.js'

export default function ConvenienceStoreScene({ selectedId, onSelect, catActive, onCat, activities, onKaiMovementChange, onMiraMovementChange, children }) {
  return <section
    className="scene"
    style={{ '--scene-aspect': scene.width / scene.height }}
    aria-label="雨夜便利店"
  >
    <SceneBackground scene={scene} />
    {scene.rainRegions.map(mask => <RainOverlay key={mask} mask={mask} />)}
    <div className="npc-overlay">
      {scene.npcs.map(npc => {
        const currentActivity = activities[npc.id]
        const logicalLocation = getNpcSceneLocation(npc.id, currentActivity)
        return <NPC
            key={npc.id}
            onMovementChange={npc.id === 'kai' ? onKaiMovementChange : npc.id === 'mira' ? onMiraMovementChange : undefined}
            npc={npc}
            visual={npcVisuals[npc.id]}
            anchor={getNpcSceneAnchor(npc.id, logicalLocation)}
            currentActivity={currentActivity}
            logicalLocation={logicalLocation}
            selected={npc.id === 'cat' ? catActive : selectedId === npc.id}
            onSelect={npc.id === 'cat' ? onCat : () => onSelect(npc.id)}
          />
      })}
    </div>
    <SceneForeground scene={scene} />
    <div className="scene-vignette" aria-hidden="true" />
    {children}
  </section>
}
