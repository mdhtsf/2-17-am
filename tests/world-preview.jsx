import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { worldEventIds } from '../shared/worldEvents.js'
import '../src/styles.css'

function WorldPreview() {
  const [world, setWorld] = useState({ event: null, responder: null, bark: null, reason: 'ready' })
  const [audio, setAudio] = useState({ status: 'locked', muted: false })
  useEffect(() => {
    const onWorld = event => setWorld(event.detail), onAudio = event => setAudio(event.detail)
    window.addEventListener('world-event-debug', onWorld)
    window.addEventListener('world-audio-debug', onAudio)
    return () => {
      window.removeEventListener('world-event-debug', onWorld)
      window.removeEventListener('world-audio-debug', onAudio)
    }
  }, [])
  return <><App /><aside aria-label="World event development controls" style={{ position: 'fixed', right: 12, top: 72, zIndex: 100, width: 300, padding: 12, background: '#142130', color: '#dfd0b6', fontSize: 12 }}>
    <strong>DEV · WORLD EVENTS</strong>
    <p>Triggers retain normal probability and interaction locks. No reaction is a valid result.</p>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{worldEventIds.map(id =>
      <button key={id} onClick={() => window.dispatchEvent(new CustomEvent('world-event-trigger', { detail: { id } }))}>{id}</button>)}</div>
    <p>EVENT: {world.event || '—'}</p>
    <p>RESPONDER: {world.responder || '—'}</p>
    <p>BARK: {world.bark || '—'}</p>
    <p>REASON: {world.reason}</p>
    <p>AUDIO STATE: {audio.status} · {audio.muted ? 'muted' : 'unmuted'}</p>
    <p>RAIN: {audio.rainState || 'baseline'}</p>
    <small>First real interaction unlocks audio. Event context expires after 30s. API needs the existing Vercel backend.</small>
  </aside></>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<WorldPreview />)
