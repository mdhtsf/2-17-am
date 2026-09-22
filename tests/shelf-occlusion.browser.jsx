import React, { act } from 'react'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { createInitialNpcActivities } from '../src/data/npcActivities.js'
import { scene } from '../src/data/scene.js'
import { sceneWaypoints } from '../src/data/sceneWaypoints.js'
import { resolveNpcRoute } from '../src/game/npcRoute.js'
import { getMovementDuration } from '../src/game/npcMovement.js'
import { CAT_MOVEMENT } from '../src/data/catVisuals.js'

export async function verifyShelfOcclusion(root, container, check) {
  for (const width of [Math.min(innerWidth, 900), Math.min(innerWidth, 390)]) {
    let activity = 'grooming', movement
    const observe = value => { movement = value }
    const render = () => act(async () => root.render(<ConvenienceStoreScene
      activities={{ ...createInitialNpcActivities(), cat: activity }}
      onCatMovementChange={observe} onSelect={() => {}} onCat={() => {}} />))
    try {
      await render()
      const world = container.querySelector('.scene')
      Object.assign(world.style, { width: `${width}px`, left: '0px', top: '0px', transform: 'none' })
      const shelf = container.querySelector('[data-occluder="merchandise-shelf"]')
      const counter = container.querySelector('[data-occluder="counter"]')
      const entity = container.querySelector('.npc-cat')
      check(getComputedStyle(shelf).pointerEvents === 'none', `${width}px: shelf never intercepts NPC clicks`)
      check(shelf.parentElement === world && shelf.src === container.querySelector('.scene-art').src,
        `${width}px: shelf reuses original pixels above the NPC stacking context`)
      const bounds = shelf.getBoundingClientRect(), original = container.querySelector('.scene-art').getBoundingClientRect()
      check(['x', 'y', 'width', 'height'].every(key => Math.abs(bounds[key] - original[key]) < .1),
        `${width}px: foreground shelf aligns exactly with the locked scene`)
      const humans = [...container.querySelectorAll('.npc-kai, .npc-mira')].map(node => node.outerHTML)
      const counterBefore = counter.outerHTML
      // Hit testing is only a test probe for Chromium's real clip and paint order.
      shelf.style.pointerEvents = 'auto'
      const at = ([x, y]) => {
        const rect = world.getBoundingClientRect()
        return [rect.x + x / scene.width * rect.width, rect.y + y / scene.height * rect.height]
      }
      const products = [[590, 660], [623, 686], [650, 719], [687, 735], [724, 756], [752, 784], [780, 804], [823, 837], [858, 886]]
      const air = [[590, 633], [650, 683], [724, 721], [823, 800], [950, 896], [504, 645], [1275, 819]]
      let start = 'cat_floor'
      for (const [nextActivity, destination] of [['watching_door', 'cat_door'], ['grooming', 'cat_floor']]) {
        activity = nextActivity
        await render()
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          let from = sceneWaypoints[start]
          for (const to of resolveNpcRoute(start, destination)) {
            check(movement.phase === 'walking' && movement.segmentTo === to.id,
              `${width}px: Cat follows original ${from.id} → ${to.id}`)
            const duration = getMovementDuration(from, to, CAT_MOVEMENT)
            const animations = entity.getAnimations()
            let covered = true, clear = true, anchored = true
            const frames = Math.ceil(duration / (1000 / 60))
            for (let frame = 0; frame <= frames; frame++) {
              const progress = frame / frames
              animations.forEach(animation => { animation.pause(); animation.currentTime = duration * progress })
              covered &&= products.every(p => document.elementFromPoint(...at(p)) === shelf)
              clear &&= air.every(p => !document.elementsFromPoint(...at(p)).includes(shelf))
              const rect = entity.getBoundingClientRect()
              const [x, y] = at([(from.x * (1 - progress) + to.x * progress) * scene.width / 100,
                (from.y * (1 - progress) + to.y * progress) * scene.height / 100])
              anchored &&= Math.abs(rect.left + rect.width / 2 - x) < 1 && Math.abs(rect.bottom - y) < 1
            }
            check(covered && clear, `${width}px: ${from.id} → ${to.id}: product pixels occlude; air and exit stay clear in every 60 Hz sample`)
            check(anchored, `${width}px: ${from.id} → ${to.id}: no ground-anchor shift`)
            await act(async () => {
              animations.forEach(animation => animation.finish())
              await new Promise(resolve => setTimeout(resolve, 35))
            })
            from = to
          }
          await act(async () => { await new Promise(resolve => setTimeout(resolve, CAT_MOVEMENT.settleMs + 35)) })
        }
        check(movement.phase === 'idle' && entity.querySelector('.cat-visual').dataset.pose === nextActivity,
          `${width}px: full ${nextActivity} route ends in the correct pose`)
        start = destination
      }
      check(counter.outerHTML === counterBefore, `${width}px: shelf addition leaves counter foreground untouched`)
      check([...container.querySelectorAll('.npc-kai, .npc-mira')].every((node, i) => node.outerHTML === humans[i]),
        `${width}px: Cat route leaves Kai/Mira visuals and anchors unchanged`)
    } finally {
      await act(async () => root.render(null))
    }
  }
}
