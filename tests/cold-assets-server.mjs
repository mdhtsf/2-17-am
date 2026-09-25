// Development-only production-build fixture. Mock provider; no model or env file.
// Run npm run build first, then node tests/cold-assets-server.mjs.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSocialHandler } from '../server/social-handler.js'
import { createChatHandler } from '../server/chat-handler.js'
const root = fileURLToPath(new URL('../dist', import.meta.url))
const failedOnce = new Set()
// Real HTTP/API validation with a deliberately fake provider, only in this fixture.
const chat = createChatHandler(async ({ npc, message }) => {
  await new Promise(resolve => setTimeout(resolve, message === '测试延迟' ? 3000 : 1000))
  if (message === '测试重试' && !failedOnce.has(npc.id)) {
    failedOnce.add(npc.id)
    throw new Error('Intentional one-time demo failure')
  }
  if (message === '测试长回复') return 'deadline'.repeat(90)
  return npc.id === 'kai' ? '夜班。总得有人醒着。' : '理论上快写完了。一个小时前我也是这么说的。'
})
const social = createSocialHandler(async () => ({ lines: [{ speaker: 'mira', text: '光标还在闪。' }, { speaker: 'kai', text: '还没下班。' }] }))
const mime = { '.mp3': 'audio/mpeg', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  if (['/api/chat', '/api/social-chat'].includes(url.pathname)) {
    try {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const handler = url.pathname === '/api/chat' ? chat : social
      const result = await handler(new Request(url, { method: request.method,
        headers: request.headers, ...(!['GET', 'HEAD'].includes(request.method)
          ? { body: Buffer.concat(chunks) } : {}) }))
      response.writeHead(result.status, Object.fromEntries(result.headers))
      response.end(await result.text())
    } catch { response.writeHead(500).end() }
    return
  }
  if (['/__demo__/production.browser.html', '/__demo__/production.browser.js'].includes(url.pathname)) {
    const data = await readFile(new URL('./' + url.pathname.split('/').at(-1), import.meta.url))
    response.writeHead(200, { 'Content-Type': mime[extname(url.pathname)], 'Cache-Control': 'no-store' })
    response.end(data)
    return
  }
  const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
  if (!file.startsWith(root + '/')) { response.writeHead(403).end(); return }
  try {
    let data = await readFile(file)
    // Repeatable first event: Kai. Keep the real 8s/16s director delays.
    if (extname(file) === '.html') data = Buffer.from(data.toString().replace('<head>', '<head><script>Math.random=()=>0</script>'))
    const initial = ['/kai.png', '/mira-idle.png', '/cat-sleeping.png'].some(path => file.endsWith(path))
    if (file.includes('/npcs/') && !initial) await new Promise(resolve => setTimeout(resolve, 12000))
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(data)
  } catch { response.writeHead(404).end() }
}).listen(5187, '127.0.0.1', () => console.log('Cold sprite fixture: http://127.0.0.1:5187 (12s delay, no-store)'))
