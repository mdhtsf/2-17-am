import SceneForeground from './SceneForeground.jsx'
import { useEffect } from 'react'
import { npcPortraits } from '../data/npcPortraits.js'
import { npcSpriteAssets } from '../data/npcSpriteAssets.js'
import { loadSprite } from '../lib/spriteAssets.js'
import NPC from './NPC'
import SceneBackground from './SceneBackground'
import RainOverlay from './RainOverlay'
import { scene } from '../data/scene'
import { getNpcSceneLocation } from '../game/npcSceneLocation.js'
import { getNpcSceneAnchor } from '../game/npcSceneAnchor.js'
import { npcVisuals } from '../data/npcVisuals.js'

export default function ConvenienceStoreScene({ selectedId, onSelect, catActive, onCat, activities, completedActivities, speech, onKaiMovementChange, onMiraMovementChange, onCatMovementChange, children }) {
  useEffect(() => { [...npcSpriteAssets, ...Object.values(npcPortraits).map(portrait => portrait.src)].forEach(loadSprite) }, [])
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
            onMovementChange={npc.id === 'kai' ? onKaiMovementChange : npc.id === 'mira' ? onMiraMovementChange : onCatMovementChange}
            npc={npc}
            speech={speech?.npcId === npc.id ? speech : null}
            visual={npcVisuals[npc.id]}
            anchor={getNpcSceneAnchor(npc.id, logicalLocation)}
            currentActivity={currentActivity}
            activityComplete={completedActivities?.[npc.id] === currentActivity}
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
