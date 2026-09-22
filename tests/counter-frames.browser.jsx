import React, { act } from 'react'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { createInitialNpcActivities } from '../src/data/npcActivities.js'
import { scene } from '../src/data/scene.js'
import { sceneWaypoints } from '../src/data/sceneWaypoints.js'
import { resolveNpcRoute } from '../src/game/npcRoute.js'
import { getMovementDuration, HUMAN_MOVEMENT } from '../src/game/npcMovement.js'

// Exercise the REAL route runner at 60 Hz positions. No alternate movement code.
// Temporarily enable hit testing on the cutout to probe Chromium's actual CSS
// clipping/paint order; production foreground always stays pointer-events:none.
export async function verifyCounterFrames(root, container, check) {
  for (const width of [Math.min(innerWidth, 900), Math.min(innerWidth, 390)]) {
    let activity = 'behind_counter'
    let movement
    const observe = value => { movement = value }
    const render = () => act(async () => root.render(<ConvenienceStoreScene
      activities={{ ...createInitialNpcActivities(), kai: activity }}
      onKaiMovementChange={observe} onSelect={() => {}} onCat={() => {}} />))
    try {
      await render()
      const world = container.querySelector('.scene')
      Object.assign(world.style, { width: `${width}px`, left: '0px', top: '0px', transform: 'none' })
      const entity = container.querySelector('.npc-kai')
      const foreground = container.querySelector('.scene-foreground')
      foreground.style.pointerEvents = 'auto'
      const at = ([x, y]) => {
        const rect = world.getBoundingClientRect()
        return [rect.x + x / scene.width * rect.width, rect.y + y / scene.height * rect.height]
      }
      // These table pixels were the exposed notch in E-0. Probe actual clip geometry.
      const covered = [[430, 447], [438, 445], [566, 397], [658, 350], [725, 470],
        [430, 436], [450, 429], [480, 420], [515, 410], [530, 405], [731, 440], [731, 480]]
      check(covered.every(point => document.elementFromPoint(...at(point)) === foreground),
        `${width}px: solid table, tills, display and exit side are foreground pixels`)
      check([[430, 425], [352, 440], [752, 470]].every(point =>
        !document.elementsFromPoint(...at(point)).includes(foreground)),
      `${width}px: rear air and clear opening are not painted by the counter`)
      let start = 'counter'
      for (const [nextActivity, destination] of [
        ['making_coffee', 'coffee_station'], ['behind_counter', 'counter'],
        ['checking_shelf', 'shelf'], ['behind_counter', 'counter'],
        ['looking_out_window', 'window'], ['behind_counter', 'counter'],
        ['checking_shelf', 'shelf'], ['behind_counter', 'counter'],
      ]) {
        activity = nextActivity
        await render()
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          let from = sceneWaypoints[start]
          for (const to of resolveNpcRoute(start, destination)) {
            check(movement.segmentTo === to.id && movement.phase === 'walking', `${width}px: walking through ${from.id} → ${to.id}`)
            const duration = getMovementDuration(from, to)
            const animations = entity.getAnimations()
            let aligned = true, occluded = true
            const frameCount = Math.ceil(duration / (1000 / 60))
            for (let frame = 0; frame <= frameCount; frame++) {
              const progress = frame / frameCount
              animations.forEach(animation => { animation.pause(); animation.currentTime = duration * progress })
              const box = entity.getBoundingClientRect()
              const [x, y] = at([((1 - progress) * from.x + progress * to.x) * scene.width / 100,
                ((1 - progress) * from.y + progress * to.y) * scene.height / 100])
              aligned &&= Math.abs(box.left + box.width / 2 - x) < 1 && Math.abs(box.bottom - y) < 1
              occluded &&= covered.every(point => document.elementFromPoint(...at(point)) === foreground)
            }
            check(aligned, `${width}px: every 60 Hz frame keeps bottom-center on ${from.id} → ${to.id}`)
            check(occluded, `${width}px: counter paint order is stable in every frame, including exit/entry`)
            await act(async () => {
              animations.forEach(animation => animation.finish())
              await new Promise(resolve => setTimeout(resolve, 30))
            })
            from = to
          }
          await act(async () => { await new Promise(resolve => setTimeout(resolve, HUMAN_MOVEMENT.settleMs + 30)) })
        }
        check(movement.phase === 'idle', `${width}px: ${destination} arrives without teleporting or a stuck walk`)
        start = destination
      }
    } finally {
      await act(async () => root.render(null))
    }
  }
}
