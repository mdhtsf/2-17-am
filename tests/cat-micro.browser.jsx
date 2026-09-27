import React, { act, StrictMode } from 'react'
import NPC from '../src/components/NPC.jsx'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { catMicroSheet } from '../src/data/catMicroVisuals.js'
import { getCatPose } from '../src/data/catVisuals.js'
import { npcSpriteAssets } from '../src/data/npcSpriteAssets.js'
import { loadSprite } from '../src/lib/spriteAssets.js'

export async function verifyCatMicro(root, container, check) {
  await Promise.all([...npcSpriteAssets, catMicroSheet].map(loadSprite))
  const originalSet = window.setTimeout, originalClear = window.clearTimeout, originalRandom = Math.random
  const timers = new Map()
  let serial = -1, movement, clicks = 0
  Math.random = () => 0.25 // 70 s opportunity / 2.5 s pose, separate from movement timers.
  window.setTimeout = (callback, delay, ...args) => {
    if (delay !== 70000 && delay !== 2500) return originalSet(callback, delay, ...args)
    const id = serial--; timers.set(id, { callback: () => callback(...args), delay }); return id
  }
  window.clearTimeout = id => timers.delete(id) || originalClear(id)
  const anchor = { x: 50, y: 70, scale: 1, zIndex: 4 }
  const observe = next => { movement = next }
  const render = (activity = 'grooming', blocked = false, selected = false, position = anchor) => act(async () => root.render(
    <StrictMode><div style={{ position: 'relative', width: 900, height: 600 }}>
      <NPC npc={{ id: 'cat', name: 'THE CAT' }} visual={npcVisuals.cat} anchor={position}
        currentActivity={activity} selected={selected} catMicroBlocked={blocked}
        onMovementChange={observe} onSelect={() => clicks++} />
    </div></StrictMode>))
  const trigger = pose => act(async () => window.dispatchEvent(new CustomEvent('cat-micro-trigger', { detail: { pose } })))
  const fire = delay => act(async () => {
    const entry = [...timers].find(([, timer]) => timer.delay === delay)
    if (!entry) throw new Error(`Missing Cat micro timer at ${delay} ms`)
    const [id, timer] = entry; timers.delete(id); timer.callback()
  })
  const sprite = () => container.querySelector('.cat-visual')
  const ground = () => {
    const box = container.querySelector('.npc-cat').getBoundingClientRect()
    return [box.left + box.width / 2, box.bottom, box.width, box.height]
  }
  try {
    await render()
    const entity = container.querySelector('.npc-cat'), label = entity.querySelector('.npc-label')
    const initialGround = ground()
    check(movement.phase === 'idle' && sprite().dataset.pose === 'grooming' && timers.size === 1,
      'Cat micro: settled grooming retains one sparse opportunity under StrictMode')
    let yawningCrop
    for (const pose of ['yawning', 'scratching']) {
      await trigger(pose)
      const image = sprite().querySelector('.cat-micro img')
      check(sprite().dataset.renderMode === 'micro' && sprite().dataset.pose === pose && image?.getAttribute('src') === catMicroSheet,
        `Cat micro ${pose}: real NPC renders its registered atlas pose`)
      check(image.complete && image.naturalWidth > 0 && getComputedStyle(image).imageRendering === 'pixelated'
        && getComputedStyle(sprite().querySelector('.npc-sprite')).opacity === '0',
      `Cat micro ${pose}: decoded pixel art replaces the idle visual without a duplicate sprite`)
      check(ground().every((value, i) => Math.abs(value - initialGround[i]) < 0.1) && movement.phase === 'idle'
        && container.querySelectorAll('.npc-cat').length === 1 && entity.querySelector('.npc-label') === label,
      `Cat micro ${pose}: footprint, foot anchor, hotspot and label remain unchanged`)
      if (pose === 'yawning') yawningCrop = image.style.left
      else check(image.style.left !== yawningCrop, 'Cat micro: scratching selects a different atlas region from yawning')
      await act(async () => entity.click())
      check(timers.size === 1 && [...timers.values()][0].delay === 2500, `Cat micro ${pose}: one finite completion replaces its opportunity timer`)
      await fire(2500)
      check(sprite().dataset.renderMode === 'idle' && sprite().dataset.pose === 'grooming'
        && sprite().querySelector('.npc-sprite').getAttribute('src') === getCatPose('grooming') && !sprite().querySelector('.cat-micro'),
      `Cat micro ${pose}: completion restores the previous grooming pose without walking`)
    }
    check(clicks === 2, 'Cat micro: both poses preserve click interaction')
    await trigger('yawning')
    const stale = [...timers.values()][0].callback
    await render('grooming', true)
    check(!sprite().querySelector('.cat-micro') && timers.size === 1 && [...timers.values()][0].delay === 70000,
      'Cat micro: world-event block cancels the pose while preserving one sparse opportunity')
    await trigger('scratching')
    check(sprite().dataset.renderMode === 'idle' && timers.size === 1, 'Cat micro: a blocked Cat rejects manual micro triggers')
    await render()
    await trigger('scratching')
    await act(async () => stale())
    check(sprite().dataset.pose === 'scratching', 'Cat micro: stale completion cannot clear a newer pose')
    await render('grooming', false, true)
    check(!sprite().querySelector('.cat-micro') && timers.size === 1, 'Cat micro: player selection immediately cancels local animation')
    await render()
    await trigger('yawning')
    await render('sleeping')
    await trigger('scratching')
    check(sprite().dataset.pose === 'sleeping' && !sprite().querySelector('.cat-micro') && timers.size === 1,
      'Cat micro: sleeping restores its own sprite and rejects idle variations')
    await render()
    await trigger('scratching')
    await render('grooming', false, false, { ...anchor, x: 60 })
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      check(movement.phase === 'walking' && sprite().dataset.renderMode === 'walk' && !sprite().querySelector('.cat-micro') && timers.size === 1,
        'Cat micro: starting a real movement cancels the pose and preserves walking animation')
      await trigger('yawning')
      check(sprite().dataset.pose === 'walking' && !sprite().querySelector('.cat-micro'), 'Cat micro: walking Cat rejects a fresh micro pose')
    }
    await act(async () => root.render(null))
    await render('watching_door')
    await trigger('scratching')
    await fire(2500)
    check(sprite().dataset.pose === 'watching_door' && sprite().querySelector('.npc-sprite').getAttribute('src') === getCatPose('watching_door'),
      'Cat micro: completion restores watching-door too, rather than forcing a generic grooming pose')
    await trigger('scratching')
    const closed = [...timers.values()][0].callback
    await act(async () => root.render(null))
    check(timers.size === 0, 'Cat micro: unmount removes active pose timer and opportunity')
    await act(async () => closed())
    await trigger('yawning')
    check(!container.querySelector('.npc-cat') && timers.size === 0, 'Cat micro: obsolete callbacks and removed dev listener cannot revive an unmounted Cat')
  } finally {
    await act(async () => root.render(null))
    window.setTimeout = originalSet; window.clearTimeout = originalClear; Math.random = originalRandom
  }
}
