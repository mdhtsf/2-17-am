// Development fixture only. Never imported by src/main.jsx or the game.
import RouteDebug from './RouteDebug.jsx'
import { useState } from 'react'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { createInitialNpcActivities, npcActivities } from '../src/data/npcActivities.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'

const initial = createInitialNpcActivities()
const cycle = npcActivities.kai

export default function MovementHarness() {
  const [activity, setActivity] = useState(cycle[0])
  const [showRoute, setShowRoute] = useState(false)
  const [movement, setMovement] = useState(null)
  if (!import.meta.env.DEV) return null
  return <>
    <ConvenienceStoreScene activities={{ ...initial, kai: activity }}
      selectedId={null} catActive={false} onSelect={() => {}} onCat={() => {}} onKaiMovementChange={setMovement}>
      {showRoute && <RouteDebug movement={movement} />}
    </ConvenienceStoreScene>
    <nav className="movement-controls" aria-label="Kai movement test">
      <strong>KAI · MOVEMENT TEST</strong>
      {cycle.map(item => <button key={item} aria-pressed={activity === item}
        onClick={() => setActivity(item)}>{getNpcSceneLocation('kai', item)}</button>)}
      <button onClick={() => setActivity(current => cycle[(cycle.indexOf(current) + 1) % cycle.length])}>Next →</button>
      <label><input type="checkbox" checked={showRoute} onChange={event => setShowRoute(event.target.checked)} /> Show route debug</label>
      {showRoute && <output className="route-status">Destination: {getNpcSceneLocation('kai', activity)} · {movement?.phase}
        <br />Route: {movement?.route?.join(' → ') || 'at destination'}
        <br />Segment: {movement?.segmentFrom || '—'} → {movement?.segmentTo || '—'}</output>}
      <small>Development only · 点击目的地立即移动 · 无环境计时器、对话或 API 请求</small>
    </nav>
  </>
}
