import React, { act } from 'react'
import NPC from '../src/components/NPC.jsx'
import DialoguePanel from '../src/components/DialoguePanel.jsx'
import { npcVisuals } from '../src/data/npcVisuals.js'
import { characters } from '../src/data/characters.js'
import { getKaiWalkingVisual } from '../src/data/kaiWalking.js'
import { getCatWalkingVisual } from '../src/data/catVisuals.js'

export async function verifyDemoPolish(root, container, check) {
  // A decoded walk may be retained after arrival while the next pose is loading.
  // Exercise that visible DOM state for both CSS animation implementations.
  await act(async () => root.render(<div>
    <span className="walking-visual" data-render-mode="walk" data-phase="idle">
      <span className="walking-sprite" style={{ '--walk-cycle': '500ms' }}>
        {[0, 1, 2, 3].map(i => <span key={i} className="walking-frame"><img src={getKaiWalkingVisual('right').src} /></span>)}
      </span>
    </span>
    <span className="walking-visual cat-visual" data-render-mode="walk" data-phase="idle">
      <span className="cat-walk" style={{ '--cat-cycle': '500ms' }}><img src={getCatWalkingVisual('right').src} /></span>
    </span>
  </div>))
  check([...container.querySelectorAll('.walking-frame')].every(frame => frame.getAnimations().length === 0),
    'arrived human holding a loaded walk frame does not resume stepping while the activity is cold')
  check(container.querySelector('.cat-walk img').getAnimations().length === 0,
    'arrived Cat holding a loaded walk frame does not step in place')
  check([...container.querySelectorAll('.walking-frame')].filter(frame => getComputedStyle(frame).opacity === '1').length === 1,
    'held human walking sheet shows exactly one static frame')

  for (const id of ['kai', 'mira', 'cat']) {
    const render = x => act(async () => root.render(<div style={{ position: 'relative', width: 1000, height: 600 }}>
      <NPC npc={{ id, name: id.toUpperCase() }} visual={npcVisuals[id]} anchor={{ x, y: 50, scale: 1, zIndex: 3 }} />
    </div>))
    await act(async () => root.render(null))
    await render(50)
    const entity = container.querySelector('.npc')
    await render(50.001)
    check(entity.querySelector('.walking-visual').dataset.phase === 'idle' && entity.getAnimations().length === 0,
      `${id}: subpixel remainder does not flash a walking cycle or leave an arrival timer`)
    check(Math.abs(parseFloat(getComputedStyle(entity).left) - 500.01) < 0.1,
      `${id}: tiny correction still places the same bottom-anchored entity at its destination`)
  }

  await act(async () => root.render(<div style={{ width: 680 }}><DialoguePanel character={characters.kai}
    history={[{ role: 'assistant', content: 'deadline'.repeat(90) }]} onClose={() => {}} /></div>))
  const panel = container.querySelector('.dialogue')
  check(panel.scrollWidth <= panel.clientWidth + 1, 'a long unbroken model reply wraps without horizontal dialogue overflow')
  check(container.querySelector('input') && container.querySelector('.close-dialogue'), 'long reply keeps input and close controls available')
  await act(async () => root.render(null))
}
