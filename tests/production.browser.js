// Served only by cold-assets-server.mjs; tests the built app over real local HTTP.
// The server supplies fake replies. No real model or environment file is involved.
const frame = document.querySelector('#demo')
const result = document.querySelector('#results')
const checks = []
const errors = []
const requests = []
const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (predicate, label, timeout = 20000) => {
  const start = Date.now()
  while (!(await predicate())) {
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`)
    await pause(50)
  }
}
let doc, win, monitor
const drainColdAssets = () => until(async () => (await (await fetch('/__demo__/asset-status')).json()).pendingSprites === 0,
  'cold sprite request queue drains', 90000)
const open = async () => {
  const path = '/?demoRun=' + Date.now()
  frame.src = path
  await until(() => frame.contentWindow.location.href.endsWith(path) && frame.contentDocument.querySelectorAll('.npc').length === 3, 'production mount')
  win = frame.contentWindow
  doc = frame.contentDocument
  win.addEventListener('error', e => errors.push(e.message))
  win.addEventListener('unhandledrejection', e => errors.push(String(e.reason)))
  const fetch = win.fetch.bind(win)
  win.fetch = (url, options) => { if (url === '/api/chat') requests.push(JSON.parse(options.body)); return fetch(url, options) }
  await until(() => doc.querySelectorAll('.npc').length === 3, 'initial characters')
}
const click = async selector => { doc.querySelector(selector).click(); await pause(50) }
const fill = value => {
  const input = doc.querySelector('input')
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new win.Event('input', { bubbles: true }))
}
const send = async text => { fill(text); await pause(25); doc.querySelector('form').requestSubmit(); await pause(25) }
const visibleImages = entity => [...entity.querySelectorAll('img')].filter(img => {
  if (!img.complete || !img.naturalWidth) return false
  for (let n = img; n && n !== entity; n = n.parentElement) {
    const style = win.getComputedStyle(n)
    if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
})
try {
  await open()
  await until(() => [...doc.querySelectorAll('.npc .npc-sprite')].every(img => img.complete && img.naturalWidth), 'base sprite load')
  const art = doc.querySelector('.scene-art').getAttribute('src')
  const samples = []
  monitor = setInterval(() => samples.push([...doc.querySelectorAll('.npc')].map(n => ({
    id: n.className, visible: visibleImages(n).length, phase: n.querySelector('.walking-visual').dataset.phase,
    mode: n.querySelector('.walking-visual').dataset.renderMode,
  }))), 100)
  // First Kai event is at 8s; sprite responses are delayed 12s with no-store.
  await pause(16000)
  clearInterval(monitor)
  check(samples.length > 100 && samples.every(s => s.length === 3 && s.every(n => n.visible === 1)),
    'cold production load: no blank or duplicate sprites throughout first movement/activity')
  check(samples.some(s => s.some(n => n.phase === 'walking')) && samples.some(s => s.some(n => n.mode === 'activity')),
    'cold sample includes walking and decoded activity visuals')
  // The fixture delays every non-base sprite by 12s, filling HTTP/1 connection
  // slots. Finish that stress phase before measuring the separate API/UX flow;
  // otherwise even a 1s fake provider can queue behind several asset batches.
  await drainColdAssets()
  await click('.npc-kai')
  check(doc.querySelector('h2').textContent === 'KAI', 'Kai dialogue opens')
  let worldDebug = 0
  win.addEventListener('world-event-debug', () => worldDebug++)
  win.dispatchEvent(new win.CustomEvent('world-event-trigger', { detail: { id: 'door_noise' } }))
  await pause(50)
  check(worldDebug === 0 && !doc.querySelector('[aria-label="World event development controls"]'), 'production ignores world debug triggers and contains no event controls')
  check(win.getComputedStyle(doc.querySelector('[data-sound-toggle]')).pointerEvents === 'auto', 'production mute control remains physically clickable')
  check(doc.querySelector('[data-portrait="kai"] img')?.complete, 'cold scene preloads the Kai portrait before opening')
  await send('今晚忙吗？')
  check(doc.querySelector('.request-status').textContent === '…', 'real HTTP request shows loading')
  doc.querySelector('form').requestSubmit()
  await until(() => doc.querySelector('.spoken').textContent === '夜班。总得有人醒着。', 'Kai reply')
  check(requests.length === 1, 'rapid repeat submit sends one HTTP request')
  check(!Object.hasOwn(requests[0], 'recentWorldEvent'), 'development event injection cannot alter production dialogue context')
  await send('再聊一句')
  await until(() => doc.querySelector('input').value === '', 'second reply')
  check(requests.at(-1).history.length === 2 && requests.at(-1).activity === 'behind_counter', 'second request includes prior turn and returned counter activity')
  await send('测试超时')
  await until(() => !doc.querySelector('input').readOnly, 'eight-second dialogue fallback')
  check(doc.querySelector('.spoken').textContent !== '夜班。总得有人醒着。' && !doc.querySelector('[role="alert"]')
    && doc.querySelector('input').value === '测试超时', 'production timeout shows in-world speech and preserves the draft')
  await send('换一个问题')
  await until(() => doc.querySelector('input').value === '', 'new request after timeout')
  check(requests.at(-1).history.length === 4, 'production retry context excludes the expired turn and fallback')
  await pause(1300)
  check(doc.querySelector('.spoken').textContent === '夜班。总得有人醒着。', 'expired HTTP response cannot overwrite the newer reply')
  await click('.npc-mira')
  check(doc.querySelector('[data-portrait="mira"] img')?.complete, 'switching shows the loaded Mira portrait')
  check(win.getComputedStyle(doc.querySelector('[data-portrait="mira"]')).transform === 'matrix(-1, 0, 0, 1, 0, 0)', 'production Mira portrait uses the approved orientation transform')
  await send('测试重试')
  await until(() => doc.querySelector('[role="alert"]'), 'injected failure')
  check(doc.querySelector('input').value === '测试重试' && requests.at(-1).history.length === 0, 'failure retains draft; Mira history is isolated')
  doc.querySelector('form').requestSubmit()
  await until(() => doc.querySelector('input').value === '', 'retry success')
  check(!doc.querySelector('[role="alert"]') && requests.at(-1).history.length === 0, 'retry recovers without failed history')
  await send('测试延迟')
  await click('.npc-kai')
  await pause(3200)
  check(doc.querySelector('h2').textContent === 'KAI' && doc.querySelector('.spoken').textContent === '夜班。总得有人醒着。', 'late response after switching cannot replace Kai dialogue')
  await send('测试长回复')
  await until(() => doc.querySelector('input').value === '', 'long reply')
  for (const [width, height] of [[1280, 720], [1440, 900], [1024, 768], [390, 844]]) {
    frame.width = width; frame.height = height
    await pause(100)
    const soundBox = doc.querySelector('[data-sound-toggle]').getBoundingClientRect()
    check(soundBox.left >= 0 && soundBox.right <= width && soundBox.top >= 0, `${width}x${height}: sound control fits viewport`)
    const panel = doc.querySelector('.dialogue')
    const box = panel.getBoundingClientRect()
    check(box.top >= 0 && box.bottom <= height && box.left >= 0 && box.right <= width && panel.scrollWidth <= panel.clientWidth + 1,
      `${width}x${height}: long reply and dialogue fit the viewport`)
    for (const npc of doc.querySelectorAll('.npc')) {
      const sprite = npc.querySelector('.walking-visual').getBoundingClientRect()
      const hit = npc.getBoundingClientRect()
      check(Math.abs(sprite.left + sprite.width / 2 - hit.left - hit.width / 2) < 1 && Math.abs(sprite.bottom - hit.bottom) < 1,
        `${width}x${height}: ${npc.className} retains shared hotspot and foot anchor`)
    }
  }
  await click('.close-dialogue')
  check(!doc.querySelector('.dialogue'), 'dialogue closes after long reply')
  await click('.npc-cat')
  check(doc.querySelector('.cat-feedback').textContent.includes('没什么意思'), 'Cat feedback still works')
  check(doc.querySelector('[data-portrait="cat"] img')?.complete, 'Cat feedback shows its loaded portrait')
  check(doc.querySelector('.scene-art').getAttribute('src') === art, 'scene artwork is unchanged throughout interaction')
  await open()
  await drainColdAssets()
  await click('.npc-kai')
  check(doc.querySelector('.spoken').textContent === '还没睡？', 'browser refresh restores opening dialogue')
  await send('刷新之后')
  await until(() => doc.querySelector('input').value === '', 'reply after refresh')
  check(requests.at(-1).history.length === 0, 'browser refresh clears session history')
  check(errors.length === 0, 'production page has no script errors or unhandled rejections')
  result.dataset.result = 'passed'
  result.textContent = JSON.stringify({ passed: checks.length, coldSamples: samples.length, checks }, null, 2)
} catch (error) {
  result.dataset.result = 'failed'
  result.textContent = JSON.stringify({ passed: checks.length, error: error.message, errors, checks }, null, 2)
} finally { clearInterval(monitor) }
