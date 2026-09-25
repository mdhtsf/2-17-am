import { useEffect, useRef, useState } from 'react'
import ConvenienceStoreScene from './components/ConvenienceStoreScene'
import DialoguePanel from './components/DialoguePanel'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import { characters, catFeedback } from './data/characters'
import { MAX_HISTORY_MESSAGES } from '../shared/npcs.js'
import { useNpcActivities } from './hooks/useNpcActivities.js'
import { useSoundscape } from './hooks/useSoundscape.js'

export default function App() {
  const [selectedId, setSelectedId] = useState(null)
  const [catActive, setCatActive] = useState(false)
  const catTimer = useRef(null)
  const [histories, setHistories] = useState({ kai: [], mira: [] })
  // Only the selected semantic activity enters dialogue; rendering state stays local.
  const ambientRuntime = useNpcActivities({ interactingId: selectedId, catInteracting: catActive })
  const sound = useSoundscape(ambientRuntime.recentWorldEvent?.id, ambientRuntime.recentWorldEvent?.sequence)

  function completeTurn(npc, message, reply) {
    setHistories(previous => ({
      ...previous,
      [npc]: [...previous[npc], { role: 'user', content: message },
        { role: 'assistant', content: reply }].slice(-MAX_HISTORY_MESSAGES),
    }))
  }

  function closeDialogue() {
    setSelectedId(null)
    document.querySelector(`.npc-${selectedId}`)?.focus()
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && selectedId) closeDialogue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  useEffect(() => () => clearTimeout(catTimer.current), [])

  function greetCat() {
    setCatActive(true)
    clearTimeout(catTimer.current)
    catTimer.current = setTimeout(() => setCatActive(false), 5000)
  }

  return <main className="game">
    <header className="game-header">
      <div className="game-title"><h1>2:17 <span>AM</span><i /></h1><p>Somewhere, someone is still awake.</p></div>
      <div className="header-ambience"><span className="weather-readout"><i /> RAIN, 14°C <span>SEPTEMBER / NIGHT 01</span></span>
        <button type="button" className="sound-toggle" data-sound-toggle
          aria-label={sound.muted ? '开启环境音' : '关闭环境音'} aria-pressed={sound.muted}
          title={sound.status === 'unavailable' ? '当前浏览器无法播放环境音' : '环境音'} onClick={sound.toggleMuted}>
          {sound.muted ? 'SOUND OFF' : 'SOUND ON'}
        </button></div>
    </header>
    <div className="world-viewport">
      <div className="location-caption" aria-hidden="true"><span className="moon">☾</span><div>AFTER HOURS<small>A small corner<br/>for the restless.</small></div></div>
      <ConvenienceStoreScene selectedId={selectedId} onSelect={setSelectedId} catActive={catActive} onCat={greetCat} activities={ambientRuntime.activities} completedActivities={ambientRuntime.completedActivities} speech={ambientRuntime.speech}
        onKaiMovementChange={ambientRuntime.movementObservers.kai}
        onMiraMovementChange={ambientRuntime.movementObservers.mira}
        onCatMovementChange={ambientRuntime.movementObservers.cat} />
      <div className="interaction-area">
        {selectedId
          ? <DialoguePanel key={selectedId} character={characters[selectedId]} history={histories[selectedId]} activity={ambientRuntime.completedActivities[selectedId] === ambientRuntime.activities[selectedId] ? undefined : ambientRuntime.activities[selectedId]} getRecentWorldEvent={ambientRuntime.getRecentWorldEvent} onComplete={completeTurn} onClose={closeDialogue} />
          : <div className="scene-invitation"><span>· · ·</span><p>No rush. The rain isn’t going anywhere.</p><small>点击角色，聊上几句</small></div>}
      </div>
    </div>
    <div className={`cat-feedback ${catActive ? 'visible' : ''}`} role="status">
      {catActive && <><CharacterPortrait npcId="cat" /><div><strong>THE CAT</strong><p>{catFeedback}</p></div></>}
    </div>
    <footer className="game-footer"><span>RAINY NIGHTS.<br/>BRIGHTER PEOPLE.</span><span>PROLOGUE 01 <i /> THE NIGHT SHIFT</span></footer>
  </main>
}
