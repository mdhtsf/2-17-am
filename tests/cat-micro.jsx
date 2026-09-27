import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { verifyCatMicro } from './cat-micro.browser.jsx'
import '../src/styles.css'

// DEV-only scene preview. Uses the real entity, art scale, route and occlusion;
// there are no dialogue API requests or production controls in this entry point.
function Preview() {
  const [activity, setActivity] = useState('grooming')
  const [blocked, setBlocked] = useState(false)
  const [movement, setMovement] = useState(null)
  const safe = !blocked && movement?.phase === 'idle' && activity !== 'sleeping'
  const trigger = pose => window.dispatchEvent(new CustomEvent('cat-micro-trigger', { detail: { pose } }))
  return <main className="game">
    <ConvenienceStoreScene selectedId={null} catActive={false} onSelect={() => {}} onCat={() => {}}
      activities={{ kai: 'behind_counter', mira: 'reading_notes', cat: activity }}
      catMicroBlocked={blocked} onCatMovementChange={setMovement} />
    <aside style={{ position: 'fixed', zIndex: 100, left: 12, top: 12, maxWidth: 390, padding: 14, background: '#0c1725ee', color: '#efd3a6', font: '12px/1.6 monospace' }}>
      <strong>CAT MICRO POSES / DEVELOPMENT ONLY</strong>
      <p>在场景原始比例下验收。动作 2–4 秒后回到原姿态；行走、睡眠或锁定时不触发。</p>
      <p>{activity} · {movement?.phase || 'initializing'} · {blocked ? 'blocked' : 'available'}</p>
      <button disabled={!safe} onClick={() => trigger('yawning')}>Yawning / 打哈欠</button>{' '}
      <button disabled={!safe} onClick={() => trigger('scratching')}>Scratching / 抓挠</button>
      <p>{['grooming', 'watching_door', 'wandering', 'sleeping'].map(id => <button key={id} onClick={() => setActivity(id)}>{id}</button>)}</p>
      <label><input type="checkbox" checked={blocked} onChange={event => setBlocked(event.target.checked)} /> 模拟交互 / 世界事件锁</label>
      <p><a href="./cat-micro.html?verify">Run browser regressions</a></p>
    </aside>
  </main>
}

if (import.meta.env.DEV) {
  const container = document.getElementById('root'), root = createRoot(container)
  if (new URLSearchParams(location.search).has('verify')) {
    const output = document.createElement('pre'), checks = []
    output.id = 'results'; output.textContent = 'Running'; container.before(output)
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    try {
      await verifyCatMicro(root, container, (condition, label) => { if (!condition) throw new Error(label); checks.push(label) })
      output.dataset.result = 'passed'; output.textContent = JSON.stringify({ passed: checks.length, checks })
    } catch (error) { output.dataset.result = 'failed'; output.textContent = JSON.stringify({ passed: checks.length, error: error.message }) }
    finally { await act(async () => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT }
  } else root.render(<Preview />)
}
