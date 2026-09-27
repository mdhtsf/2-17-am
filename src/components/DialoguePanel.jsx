import { useEffect, useRef, useState } from 'react'
import CharacterPortrait from './CharacterPortrait.jsx'
import { sendChat } from '../lib/chat'
import { MAX_MESSAGE_LENGTH } from '../../shared/npcs.js'
import { slowReplyLine } from '../data/dialogueFallbacks.js'

export default function DialoguePanel({ character, history, activity, getRecentWorldEvent, onComplete, onClose }) {
  const [preset, setPreset] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slowReply, setSlowReply] = useState(null)
  const closeRef = useRef(null)
  const inputRef = useRef(null)
  const requestRef = useRef(null)
  const lastReply = history.at(-1)?.content

  useEffect(() => {
    closeRef.current?.focus()
    return () => {
      const request = requestRef.current
      requestRef.current = null
      clearTimeout(request?.timeout)
      request?.controller.abort()
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    const text = message.trim()
    if (!text || text.length > MAX_MESSAGE_LENGTH || requestRef.current) return
    const controller = new AbortController()
    const request = { controller, timeout: null }
    requestRef.current = request // Immediate lock also covers rapid Enter presses.
    setLoading(true)
    setError('')
    request.timeout = setTimeout(() => {
      if (requestRef.current !== request) return
      // Invalidate and settle the UI before aborting: transport cancellation may
      // arrive late (or never). It must not block retry or overwrite a newer turn.
      requestRef.current = null
      controller.abort()
      setSlowReply(slowReplyLine(character.id))
      setPreset(null)
      setLoading(false)
      inputRef.current?.focus()
    }, 8000)
    try {
      const reply = await sendChat({ npc: character.id, message: text, history, activity,
        recentWorldEvent: getRecentWorldEvent?.(), signal: controller.signal })
      if (requestRef.current !== request) return
      if (controller.signal.aborted) throw new Error('Dialogue request aborted')
      onComplete(character.id, text, reply)
      setPreset(null)
      setSlowReply(null)
      setMessage('')
    } catch {
      if (requestRef.current === request) {
        setError('雨声有点大，刚才那句没传过去。再试一次？')
      }
    } finally {
      clearTimeout(request.timeout)
      if (requestRef.current === request) {
        requestRef.current = null
        setLoading(false)
        inputRef.current?.focus()
      }
    }
  }

  return <section className="dialogue" aria-label={`与${character.dialogueName}对话`}>
    <CharacterPortrait npcId={character.id} />
    <div className="dialogue-body">
    <div className="dialogue-identity">
      <h2>{character.dialogueName}</h2><span>{character.role}</span>
    </div>
    <div className="dialogue-content" aria-live="polite">
      <p className="spoken">{slowReply || (preset !== null ? character.replies[preset].text : lastReply || character.opening)}</p>
      <p className="stage-direction">{slowReply || preset !== null || lastReply ? '你们安静了一会儿，只听见雨声。' : character.detail}</p>
      <div className="replies">
        {character.replies.map((item, i) => <button
          key={item.label} disabled={loading} aria-pressed={preset === i}
          onClick={() => { setPreset(i); setSlowReply(null); setError('') }}
        ><span aria-hidden="true">▸</span> {item.label}</button>)}
      </div>
    </div>
    <form className="dialogue-input" onSubmit={submit}>
      <label className="visually-hidden" htmlFor={`message-${character.id}`}>对{character.name}说些什么</label>
      <input
        id={`message-${character.id}`} ref={inputRef} value={message}
        onChange={event => setMessage(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        }}
        maxLength={MAX_MESSAGE_LENGTH} readOnly={loading} autoComplete="off"
        placeholder="说点什么……" aria-describedby={error ? 'dialogue-error' : undefined}
      />
      <button type="submit" disabled={loading || !message.trim()} aria-label="发送">{loading ? '…' : '说完了 ▸'}</button>
    </form>
    <div className="request-status" role="status">{loading ? '…' : ''}</div>
    {error && <p id="dialogue-error" className="dialogue-error" role="alert">{error}</p>}
    </div>
    <button className="close-dialogue" ref={closeRef} onClick={onClose} aria-label="关闭对话">×</button>
    <span className="dialogue-corner" aria-hidden="true">▾</span>
  </section>
}
