import React, { act } from 'react'
import MovementHarness from './MovementHarness.jsx'
import { npcActivities } from '../src/data/npcActivities.js'
import { getActivityVisual } from '../src/data/npcActivityVisuals.js'

export async function verifyActivityVisuals(root, container, check) {
  await act(async () => root.render(<MovementHarness />))
  const background = container.querySelector('.scene-art').outerHTML
  const foreground = [...container.querySelectorAll('.scene-foreground')].map(el => el.outerHTML).join('')
  const cat = container.querySelector('.npc-cat').outerHTML
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  for (const id of ['kai', 'mira']) {
    await act(async () => {
      const select = container.querySelector('select')
      select.value = id
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const entity = container.querySelector(`.npc-${id}`)
    const reserve = entity.querySelector('.npc-sprite')
    const buttons = [...container.querySelectorAll('.activity-controls button')]
    check(buttons.map(button => button.textContent).join(',') === npcActivities[id].join(','), `${id}: harness exposes every activity including same-location alternatives`)
    for (const button of buttons) {
      const activity = button.textContent
      const priorLocation = entity.dataset.location
      const priorActivity = entity.dataset.activity
      await act(async () => button.click())
      const pose = getActivityVisual(id, activity)
      const crop = entity.querySelector('.activity-sprite')
      const renderer = entity.querySelector('.walking-visual')
      check(entity === container.querySelector(`.npc-${id}`) && entity.contains(reserve), `${id}/${activity}: stable entity and geometry canvas`)
      if (pose) {
        await act(async () => crop.querySelector('img').decode())
        check(crop.dataset.pose === activity && crop.querySelector('img').naturalWidth > 0, `${id}/${activity}: correct loaded transparent pose sheet`)
      } else check(!crop, 'Kai counter keeps original idle artwork')
      if (priorLocation === entity.dataset.location) {
        check(renderer.dataset.phase === 'idle' && entity.getAnimations().length === 0, `${id}/${activity}: same-location switch never walks`)
        if (priorActivity !== activity) check(Boolean(crop) && getComputedStyle(crop).opacity === '1', `${id}/${activity}: direct pose switch is visible`)
      }
      // Complete each existing CSS segment without changing routing or speed.
      for (let i = 0; i < 30 && renderer.dataset.phase !== 'idle'; i++) {
        if (renderer.dataset.phase === 'walking' && !reduced) {
          check(Boolean(entity.querySelector('.walking-sprite')) && (!crop || getComputedStyle(crop).opacity === '0'), `${id}/${activity}: route segment keeps walking visible and activity hidden`)
        }
        await act(async () => {
          entity.getAnimations().forEach(animation => animation.finish())
          await new Promise(resolve => setTimeout(resolve, 40))
        })
      }
      check(renderer.dataset.phase === 'idle', `${id}/${activity}: arrival completes existing movement`)
      check(!entity.querySelector('.walking-sprite'), `${id}/${activity}: walking yields only after arrival`)
      check(pose ? getComputedStyle(crop).opacity === '1' && getComputedStyle(reserve).opacity === '0'
        : getComputedStyle(reserve).opacity === '1', `${id}/${activity}: exactly the matching activity visual is shown (pose=${crop && getComputedStyle(crop).opacity}, idle=${getComputedStyle(reserve).opacity}, attached=${crop?.isConnected})`)
      check(getComputedStyle(entity).width && entity.contains(entity.querySelector('.npc-label')), `${id}/${activity}: hotspot and label remain in the anchored entity`)
      check(container.querySelector('.scene-art').outerHTML === background && [...container.querySelectorAll('.scene-foreground')].map(el => el.outerHTML).join('') === foreground, `${id}/${activity}: scene and occlusion unchanged`)
      check(container.querySelector('.npc-cat').outerHTML === cat, `${id}/${activity}: Cat stays unchanged`)
    }
  }
  await act(async () => root.render(null))
}
