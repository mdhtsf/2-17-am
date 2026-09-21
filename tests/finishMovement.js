import { act } from 'react'
import { KAI_MOVEMENT } from '../src/game/npcMovement.js'

// Wait for the whole route, including newly started CSS segments, not just the
// first Animation.finished promise. A bounded loop catches stuck lifecycle bugs.
export async function finishMovement(nodes) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await act(async () => {
      await Promise.all(nodes.flatMap(node => node.getAnimations().map(animation => animation.finished.catch(error => {
        // At a corner the next segment can replace the last transform transition
        // in the same frame. Keep waiting for the route, but never swallow other errors.
        if (error.name !== 'AbortError') throw error
      }))))
      await new Promise(resolve => setTimeout(resolve, KAI_MOVEMENT.settleMs + KAI_MOVEMENT.completionGraceMs + 20))
    })
    if (nodes.every(node => !node.querySelector('.walking-visual') || node.querySelector('.walking-visual').dataset.phase === 'idle')) return
  }
  throw new Error('Route did not finish')
}
