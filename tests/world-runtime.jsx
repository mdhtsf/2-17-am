import React from 'react'
import { createRoot } from 'react-dom/client'
import { verifyWorldEvents } from './world-events.browser.jsx'
import { npcSpriteAssets } from '../src/data/npcSpriteAssets.js'
import { loadSprite } from '../src/lib/spriteAssets.js'
import '../src/styles.css'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const output = document.getElementById('results'), checks = []
try {
  await Promise.all(npcSpriteAssets.map(loadSprite))
  await verifyWorldEvents(createRoot(document.getElementById('test-root')), document.getElementById('test-root'), (condition, label) => {
    if (!condition) throw new Error(label)
    checks.push(label)
  })
  output.dataset.result = 'passed'; output.textContent = JSON.stringify({ passed: checks.length, checks })
} catch (error) {
  output.dataset.result = 'failed'; output.textContent = JSON.stringify({ passed: checks.length, error: error.message, stack: error.stack })
}
