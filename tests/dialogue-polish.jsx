import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { verifyDialoguePolish } from './dialogue-polish.browser.jsx'
import { verifyPortraits } from './portraits.browser.jsx'
import { npcSpriteAssets } from '../src/data/npcSpriteAssets.js'
import { loadSprite } from '../src/lib/spriteAssets.js'
import '../src/styles.css'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const output = document.getElementById('results'), checks = []
const container = document.getElementById('test-root'), root = createRoot(container)
try {
  await Promise.all(npcSpriteAssets.map(loadSprite))
  const check = (condition, label) => {
    if (!condition) throw new Error(label)
    checks.push(label)
  }
  await verifyPortraits(root, container, check)
  await verifyDialoguePolish(root, container, check)
  output.dataset.result = 'passed'; output.textContent = JSON.stringify({ passed: checks.length, checks })
} catch (error) {
  output.dataset.result = 'failed'; output.textContent = JSON.stringify({ passed: checks.length, error: error.message })
} finally {
  await act(async () => root.unmount())
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
}
