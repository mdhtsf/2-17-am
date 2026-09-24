// DEV only: trigger existing social opportunity or isolate the API from movement.
import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { requestSocialDialogue } from '../src/lib/socialChat.js'
import { SOCIAL_CLIENT_TIMEOUT_MS } from '../shared/socialTiming.js'
import '../src/styles.css'
const originalSet = window.setTimeout, originalClear = window.clearTimeout
let opportunity = null
window.setTimeout = (fn, ms, ...args) => {
  const id = originalSet(fn, ms, ...args)
  if (ms >= 90000 && ms <= 180000) opportunity = { id, fn }
  return id
}
window.clearTimeout = id => { if (opportunity?.id === id) opportunity = null; originalClear(id) }
function CounterPreview() {
  const [events, setEvents] = useState([])
  const [phase, setPhase] = useState('Ready')
  const [apiPending, setApiPending] = useState(false)
  const apiRequest = useRef(null), apiCount = useRef(0)
  const record = detail => setEvents(previous => {
    const old = previous.find(e => e.attempt === detail.attempt)
    return [...previous.filter(e => e.attempt !== detail.attempt), { ...old, ...detail }].slice(-10)
  })
  useEffect(() => {
    const update = ({ detail }) => {
      setPhase(detail.phase)
      if (detail.attempt) record({ ...detail, attempt: `Scene ${detail.attempt}` })
    }
    window.addEventListener('counter-social-debug', update)
    return () => { window.removeEventListener('counter-social-debug', update); apiRequest.current?.abort() }
  }, [])
  const testApi = async () => {
    if (apiRequest.current) return
    const controller = new AbortController()
    apiRequest.current = controller; setApiPending(true)
    const attempt = `API ${++apiCount.current}`, start = Date.now()
    record({attempt, phase:'request_started'})
    const timeout = originalSet(() => controller.abort(), SOCIAL_CLIENT_TIMEOUT_MS)
    try {
      const result = await requestSocialDialogue({ kaiActivity:'behind_counter', miraActivity:'talking_to_kai', miraPreviousActivity:'reading_notes', recentExchanges:[] }, controller.signal)
      record({attempt, ...result, lines:result.lines?.map(({speaker,text})=>({npcId:speaker,text})), phase:'response_received', elapsedMs:Date.now()-start})
    } catch {
      record({attempt, source:'fallback', reason:controller.signal.aborted?'timeout':'network_error', elapsedMs:Date.now()-start})
    } finally { originalClear(timeout); apiRequest.current=null; setApiPending(false) }
  }
  return <><App /><aside style={{position:'fixed',right:12,top:62,zIndex:100,width:350,maxHeight:'75vh',overflow:'auto',padding:10,background:'#142130',color:'#dfd0b6',fontSize:12}}>
    <button onClick={() => {
      if (opportunity) { const {id,fn}=opportunity;opportunity=null;originalClear(id);fn() }
    }}>Dev · Try counter conversation</button>
    <button disabled={apiPending} onClick={testApi}>Dev · Test social API only</button>
    <p>{phase} · Last 10 attempts · API-only test does not move NPCs</p>
    {events.map(event => <section key={event.attempt} style={{borderTop:'1px solid #89928c',padding:'8px 0'}}>
      <strong>Attempt #{event.attempt} · SOURCE: {event.source?.toUpperCase() || 'PENDING'}</strong>
      <div>REASON: {event.reason || '—'}</div>
      <div>{event.detail}</div>
      <div>Latency: {event.elapsedMs == null ? '—' : `${(event.elapsedMs/1000).toFixed(1)}s`} · {event.phase}</div>
      {event.diagnostics?.map((item,i)=><div key={i}>{item.event} {item.model} {item.httpStatus != null ? `HTTP ${item.httpStatus}` : ''} {item.providerCode != null ? `provider ${item.providerCode}` : ''} {item.detail}</div>)}
      <div>Dialogue:</div>
      {event.lines?.map((line,i)=><div key={i}>{line.npcId.toUpperCase()}: {line.text}</div>)}
    </section>)}
  </aside></>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<CounterPreview />)
