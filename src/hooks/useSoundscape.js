import { useCallback, useEffect, useRef, useState } from 'react'
import { createSoundscape } from '../audio/soundscape.js'

export function useSoundscape(eventId, sequence) {
  const controller = useRef(null), preference = useRef(false), latestEvent = useRef(eventId)
  latestEvent.current = eventId
  const [state, setState] = useState({ status: 'locked', muted: false })
  useEffect(() => {
    const sound = createSoundscape({
      createContext: () => {
        const Context = window.AudioContext || window.webkitAudioContext
        return Context ? new Context() : null
      },
      onState: next => {
        setState(next)
        if (import.meta.env.DEV) window.dispatchEvent(new CustomEvent('world-audio-debug', { detail: next }))
      },
    })
    controller.current = sound
    sound.setMuted(preference.current)
    sound.applyEvent(latestEvent.current)
    const gesture = event => {
      if (!event.isTrusted) return
      // The button handles its own gesture after updating preference, avoiding a
      // brief audible start when the user's very first action is to mute.
      if (event.target instanceof Element && event.target.closest('[data-sound-toggle]')) return
      if (event.type === 'keydown' && (event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
          ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return
      void sound.unlock()
    }
    window.addEventListener('pointerdown', gesture, true)
    window.addEventListener('keydown', gesture, true)
    return () => {
      window.removeEventListener('pointerdown', gesture, true)
      window.removeEventListener('keydown', gesture, true)
      controller.current = null; sound.dispose()
    }
  }, [])
  useEffect(() => { controller.current?.applyEvent(eventId) }, [eventId, sequence])
  const toggleMuted = useCallback(event => {
    preference.current = !preference.current
    controller.current?.setMuted(preference.current)
    if (event.nativeEvent.isTrusted) void controller.current?.unlock()
  }, [])
  return { ...state, toggleMuted }
}
