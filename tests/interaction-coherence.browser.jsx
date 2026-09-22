import React, { act } from 'react'
import App from '../src/App.jsx'

export async function verifyInteractionCoherence(root, container, check, clock) {
  await act(async () => root.render(<App />))
  await act(async () => container.querySelector('.npc-kai').click())
  const kai = () => container.querySelector('.npc-kai').dataset.activity
  await clock.tick(8000)
  check(kai() === 'behind_counter', 'open Kai dialogue excludes Kai from first ambient reassignment')
  check(container.querySelector('.npc-mira').dataset.activity === 'checking_phone', 'other NPC may change activity during Kai conversation')
  await clock.tick(16000)
  check(kai() === 'behind_counter' && container.querySelector('.npc-cat').dataset.activity === 'grooming', 'dialogue lock persists beyond one event while Cat remains eligible')
  await act(async () => container.querySelector('.close-dialogue').click())
  await clock.tick(16000)
  check(kai() === 'making_coffee', 'closing dialogue restores Kai ambient eligibility without a new scheduler')
  await act(async () => root.render(null))
}
