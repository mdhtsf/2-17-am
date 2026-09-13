import { useEffect, useRef, useState } from 'react'
import ConvenienceStoreScene from './components/ConvenienceStoreScene'
import DialoguePanel from './components/DialoguePanel'
import { characters, catFeedback } from './data/characters'

export default function App() {
  const [selectedId, setSelectedId] = useState(null)
  const [catActive, setCatActive] = useState(false)
  const catTimer = useRef(null)

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
      <span className="weather-readout"><i /> RAIN, 14°C <span>SEPTEMBER / NIGHT 01</span></span>
    </header>
    <div className="world-viewport">
      <div className="location-caption" aria-hidden="true"><span className="moon">☾</span><div>AFTER HOURS<small>A small corner<br/>for the restless.</small></div></div>
      <ConvenienceStoreScene selectedId={selectedId} onSelect={setSelectedId} catActive={catActive} onCat={greetCat} />
      <div className="interaction-area">
        {selectedId
          ? <DialoguePanel key={selectedId} character={characters[selectedId]} onClose={closeDialogue} />
          : <div className="scene-invitation"><span>· · ·</span><p>No rush. The rain isn’t going anywhere.</p><small>点击角色，聊上几句</small></div>}
      </div>
    </div>
    <div className={`cat-feedback ${catActive ? 'visible' : ''}`} role="status">
      {catActive && catFeedback}
    </div>
    <footer className="game-footer"><span>RAINY NIGHTS.<br/>BRIGHTER PEOPLE.</span><span>PROLOGUE 01 <i /> THE NIGHT SHIFT</span></footer>
  </main>
}
