import { useEffect, useSyncExternalStore } from 'react'
import { npcPortraits } from '../data/npcPortraits.js'
import { loadSprite, spriteReady, subscribeSprites } from '../lib/spriteAssets.js'

export default function CharacterPortrait({ npcId }) {
  const portrait = npcPortraits[npcId]
  const ready = useSyncExternalStore(subscribeSprites, () => spriteReady(portrait.src), () => false)
  useEffect(() => { loadSprite(portrait.src) }, [portrait.src])
  const { crop } = portrait
  return <aside className="portrait-column" aria-hidden="true">
    <span className="character-portrait" data-portrait={npcId} style={{ aspectRatio: `${crop.width} / ${crop.height}` }}>
      {ready ? <img src={portrait.src} alt="" draggable="false" style={{
        width: `${portrait.width / crop.width * 100}%`,
        left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%`,
      }} /> : <span className="portrait-loading">···</span>}
    </span>
  </aside>
}
