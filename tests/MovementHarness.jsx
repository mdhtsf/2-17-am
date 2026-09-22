// Development fixture only. Never imported by src/main.jsx or the game.
import RouteDebug from './RouteDebug.jsx'
import { useState } from 'react'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { createInitialNpcActivities, npcActivities } from '../src/data/npcActivities.js'
import { getNpcSceneLocation } from '../src/game/npcSceneLocation.js'

const initial = createInitialNpcActivities()

export default function MovementHarness() {
  const [npcId, setNpcId] = useState('kai')
  const [activities, setActivities] = useState(initial)
  const [showRoute, setShowRoute] = useState(false)
  const [kaiMovement, setKaiMovement] = useState(null)
  const [miraMovement, setMiraMovement] = useState(null)
  const [catMovement, setCatMovement] = useState(null)
  const movement = { kai: kaiMovement, mira: miraMovement, cat: catMovement }[npcId]
  // One button per actual activity destination (notes and phone share a spot).
  const cycle = npcId === 'cat' ? npcActivities.cat : npcActivities[npcId].filter((item, index, all) => all.findIndex(other =>
    getNpcSceneLocation(npcId, other) === getNpcSceneLocation(npcId, item)) === index)
  const activity = activities[npcId]
  const setActivity = value => setActivities(current => ({ ...current, [npcId]: value }))
  if (!import.meta.env.DEV) return null
  return <>
    <ConvenienceStoreScene activities={activities}
      selectedId={null} catActive={false} onSelect={() => {}} onCat={() => {}}
      onKaiMovementChange={setKaiMovement} onMiraMovementChange={setMiraMovement} onCatMovementChange={setCatMovement}>
      {showRoute && <RouteDebug movement={movement} npcId={npcId} />}
    </ConvenienceStoreScene>
    <nav className="movement-controls" aria-label={`${npcId === 'kai' ? 'Kai' : npcId === 'mira' ? 'Mira' : 'Cat'} movement test`}>
      <strong>{npcId.toUpperCase()} · MOVEMENT TEST</strong>
      <select aria-label="Test NPC" value={npcId} onChange={event => setNpcId(event.target.value)}>
        <option value="kai">Kai</option><option value="mira">Mira</option><option value="cat">Cat</option>
      </select>
      {cycle.map(item => <button key={item} aria-pressed={activity === item}
        onClick={() => setActivity(item)}>{getNpcSceneLocation(npcId, item)}{npcId === 'cat' ? ` / ${item}` : ''}</button>)}
      <button onClick={() => setActivity(cycle[(cycle.indexOf(activity) + 1) % cycle.length])}>Next →</button>
      <label><input type="checkbox" checked={showRoute} onChange={event => setShowRoute(event.target.checked)} /> Show route debug</label>
      {showRoute && <output className="route-status">Destination: {getNpcSceneLocation(npcId, activity)} · {movement?.phase}
        <br />Route: {movement?.route?.join(' → ') || 'at destination'}
        <br />Segment: {movement?.segmentFrom || '—'} → {movement?.segmentTo || '—'}</output>}
      <small>Development only · 点击目的地立即移动 · 无环境计时器、对话或 API 请求</small>
    </nav>
  </>
}
