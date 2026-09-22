import React, { act, StrictMode } from 'react'
import MovementHarness from './MovementHarness.jsx'
import { finishMovement } from './finishMovement.js'
import { getMovementDirection } from '../src/game/npcMovement.js'
import { sceneWaypoints, sceneWaypointEdges } from '../src/data/sceneWaypoints.js'

export async function verifyMovementHarness(root, container, check, intervalClock) {
  const originalFetch = window.fetch
  let requests = 0
  window.fetch = async () => { requests++; throw new Error('Movement must not call an API') }
  const timerCount = intervalClock.timers.size
  try {
    await act(async () => root.render(<StrictMode><MovementHarness /></StrictMode>))
    const background = container.querySelector('.scene-art').outerHTML
    const others = [...container.querySelectorAll('.npc-mira, .npc-cat')].map(node => node.outerHTML)
    check(!container.querySelector('.route-debug'), 'route debug is off by default')
    await act(async () => container.querySelector('.movement-controls input').click())
    check(Boolean(container.querySelector('.route-debug')) && container.querySelectorAll('.route-edge').length === sceneWaypointEdges.length, 'development toggle displays the authored graph')
    check(Boolean(container.querySelector('.shelf-occlusion-debug')), 'route debug exposes the near-shelf merchandise silhouette')
    check(Boolean(container.querySelector('.counter-occlusion-debug')), 'route debug exposes the actual counter silhouette for visual alignment checks')
    const buttons = [...container.querySelectorAll('.movement-controls button')]
    check(buttons.length === 5, 'development harness exposes four real destinations and Next')
    for (let i = 1; i <= 4; i++) {
      const index = i % 4
      await act(async () => buttons[index].click())
      check(container.querySelector('.npc-kai').dataset.location === buttons[index].textContent, `harness click ${i} immediately targets the real Kai entity`)
    }
    await act(async () => buttons[4].click())
    check(container.querySelector('.npc-kai').dataset.location === 'coffee_station', 'Next follows the existing Kai destination cycle')
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const entity = container.querySelector('.npc-kai')
      const finish = () => finishMovement([entity])
      await act(async () => buttons[0].click())
      await finish()
      await act(async () => buttons[3].click())
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
      const position = () => {
        const style = getComputedStyle(entity)
        return [parseFloat(style.left), parseFloat(style.top)]
      }
      const beforeTurn = position()
      await act(async () => buttons[2].click())
      check(Math.hypot(...position().map((value, index) => value - beforeTurn[index])) < 5, 'interruption continues at the rendered position without teleporting')
      const target = sceneWaypoints[entity.querySelector('.kai-visual').dataset.waypoint]
      const origin = { x: beforeTurn[0] / entity.offsetParent.clientWidth * 100, y: beforeTurn[1] / entity.offsetParent.clientHeight * 100 }
      check(entity.querySelector('.kai-visual').dataset.direction === getMovementDirection(origin, target), 'interrupted facing follows the next safe waypoint rather than abandoned destination')
      const duration = parseFloat(entity.style.getPropertyValue('--npc-move-duration'))
      const transitions = entity.getAnimations()
      check(transitions.length > 0 && transitions.every(animation => animation.effect.getTiming().duration === duration), 'interruption uses the new duration without CSS reverse shortening')
      const samples = []
      for (const fraction of [0.25, 0.5, 0.75]) {
        transitions.forEach(animation => { animation.pause(); animation.currentTime = duration * fraction })
        samples.push(position())
      }
      check(samples[0].every((_, axis) => Math.abs((samples[2][axis] - samples[1][axis]) - (samples[1][axis] - samples[0][axis])) < 1), 'equal time slices have equal displacement at steady walking velocity')
      transitions.forEach(animation => animation.play())
      await finish()
      check(entity.querySelector('.kai-visual').dataset.phase === 'idle', 'real CSS arrival and brief settle finish in idle')
    }
    check(intervalClock.timers.size === timerCount, 'debug harness installs or changes no ambient intervals')
    check(requests === 0, 'debug movement makes no chat or other API calls')
    check(container.querySelector('.scene-art').outerHTML === background, 'debug controls reuse unchanged production scene')
    check([...container.querySelectorAll('.npc-mira, .npc-cat')].every((node, index) => node.outerHTML === others[index]), 'debug destinations never move Mira or Cat')
    const untouched = [...container.querySelectorAll('.npc-kai, .npc-cat')].map(node => node.outerHTML)
    await act(async () => {
      const selector = container.querySelector('select')
      selector.value = 'mira'
      selector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const miraButtons = [...container.querySelectorAll('.movement-controls button')]
    check(miraButtons.map(button => button.textContent).join(',') === 'notes_spot,fridge,window,Next →', 'Mira harness offers her own unique activity destinations and Next')
    check(container.querySelector('.route-debug').getAttribute('aria-label') === 'Mira waypoint graph', 'route debug switches to Mira')
    for (const index of [1, 2, 0, 3]) {
      await act(async () => miraButtons[index].click())
      const entity = container.querySelector('.npc-mira')
      check(entity.dataset.location === (index === 3 ? 'fridge' : miraButtons[index].textContent), `Mira harness button ${index} immediately targets real activity location`)
      check(window.matchMedia('(prefers-reduced-motion: reduce)').matches || entity.querySelector('.mira-visual').dataset.phase === 'walking', 'Mira immediately plays walking frames without ambient delay')
      await finishMovement([entity])
    }
    check([...container.querySelectorAll('.npc-kai, .npc-cat')].every((node, index) => node.outerHTML === untouched[index]), 'Mira controls preserve accepted Kai and Cat entities')
    check(requests === 0 && intervalClock.timers.size === timerCount, 'Mira harness changes no API or ambient timing')
    const humans = [...container.querySelectorAll('.npc-kai, .npc-mira')].map(node => node.outerHTML)
    await act(async () => {
      const selector = container.querySelector('select')
      selector.value = 'cat'
      selector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const catButtons = [...container.querySelectorAll('.movement-controls button')]
    check(catButtons.map(button => button.textContent).join(',') === 'floor / sleeping,floor / grooming,door / watching_door,aisle / wandering,Next →',
      'Cat harness exposes all four activities, including both floor poses, and Next')
    check(container.querySelector('.route-debug').getAttribute('aria-label') === 'Cat waypoint graph', 'route debug supports Cat')
    const cat = container.querySelector('.npc-cat')
    await act(async () => catButtons[1].click())
    check(cat.dataset.activity === 'grooming' && cat.getAnimations().length === 0, 'Cat grooming control changes pose without moving')
    for (const index of [2, 3, 0, 4]) {
      await act(async () => catButtons[index].click())
      check(cat.dataset.activity === ['sleeping', 'grooming', 'watching_door', 'wandering', 'grooming'][index], 'Cat harness immediately changes activity')
      // Drive existing CSS transitions to completion; no real ambient waiting.
      for (let step = 0; step < 12 && cat.querySelector('.cat-visual').dataset.phase === 'walking'; step++) {
        await act(async () => {
          cat.getAnimations().forEach(animation => animation.finish())
          await new Promise(resolve => setTimeout(resolve, 35))
        })
      }
      await finishMovement([cat])
      check(cat.querySelector('.cat-visual').dataset.phase === 'idle', 'Cat harness reaches activity destination')
    }
    check([...container.querySelectorAll('.npc-kai, .npc-mira')].every((node, index) => node.outerHTML === humans[index]), 'Cat harness leaves both human entities unchanged')
    check(requests === 0 && intervalClock.timers.size === timerCount, 'Cat harness changes no API or ambient timing')

  } finally {
    await act(async () => root.render(null))
    window.fetch = originalFetch
  }
}
