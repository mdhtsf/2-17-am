import { useEffect, useRef, useState } from 'react'

export default function DialoguePanel({ character, onClose }) {
  const [reply, setReply] = useState(null)
  const closeRef = useRef(null)

  useEffect(() => { closeRef.current?.focus() }, [])

  return <section className="dialogue" aria-label={`与${character.dialogueName}对话`}>
    <div className="dialogue-identity">
      <h2>{character.dialogueName}</h2>
      <span>{character.role}</span>
    </div>
    <div className="dialogue-content" aria-live="polite">
      <p className="spoken">{reply === null ? character.opening : character.replies[reply].text}</p>
      <p className="stage-direction">{reply === null ? character.detail : '你们安静了一会儿，只听见雨声。'}</p>
      <div className="replies">
        {character.replies.map((item, i) => (
          <button key={item.label} aria-pressed={reply === i} onClick={() => setReply(i)}>
            <span aria-hidden="true">▸</span> {item.label}
          </button>
        ))}
      </div>
    </div>
    <button className="close-dialogue" ref={closeRef} onClick={onClose} aria-label="关闭对话">×</button>
    <span className="dialogue-corner" aria-hidden="true">▾</span>
  </section>
}
