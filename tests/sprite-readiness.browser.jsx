import React, { act } from 'react'
import { useLoadedSprite } from '../src/hooks/useLoadedSprite.js'
import { loadSprite, spriteReady } from '../src/lib/spriteAssets.js'

export async function verifySpriteReadiness(root, container, check) {
  const OriginalImage = window.Image
  const pending = new Map()
  let created = 0
  window.Image = class {
    constructor() { created++; this.decoded = new Promise(resolve => { this.finishDecode = resolve }) }
    set src(value) { pending.set(value, this) }
    decode() { return this.decoded }
  }
  const idle = { kind: 'idle', src: '/assets/npcs/kai.png' }
  const a = { kind: 'activity', src: '/assets/npcs/activities/kai-activities.png?decode-test-a' }
  const b = { kind: 'walk', src: '/assets/npcs/kai/kai-walk-side.png?decode-test-b' }
  const c = { kind: 'activity', src: '/assets/npcs/activities/kai-activities.png?decode-test-c' }
  function Harness({ target }) {
    const selected = useLoadedSprite(target, idle)
    return <img data-kind={selected.kind} src={selected.src} alt="sprite witness" />
  }
  const render = target => act(async () => root.render(<Harness target={target} />))
  const src = () => container.querySelector('img').getAttribute('src')
  const finish = async target => act(async () => { pending.get(target.src).finishDecode(); await pending.get(target.src).onload() })
  try {
    await render(a)
    check(src() === idle.src, 'cold activity retains the existing idle sprite')
    check(loadSprite(a.src) === loadSprite(a.src) && created === 1, 'preload and renderer share one pending asset load')
    await act(async () => { pending.get(a.src).onload() })
    check(src() === idle.src && !spriteReady(a.src), 'network onload alone cannot hide idle before image decode')
    await finish(a)
    check(src() === a.src && container.querySelectorAll('img').length === 1, 'decoded activity replaces old visual without duplicate sprites')
    await render(b)
    check(src() === a.src, 'cold walking sheet retains the last activity visual')
    await render(c)
    await finish(b)
    check(src() === a.src, 'late obsolete walking decode cannot replace the newer requested pose')
    await act(async () => pending.get(c.src).onerror())
    check(src() === a.src, 'failed next asset leaves previous drawable visible')
    await act(async () => root.render(null))
  } finally { window.Image = OriginalImage }
}
