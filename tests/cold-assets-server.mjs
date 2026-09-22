// Development-only production-build fixture. No backend, real model, or env file.
// Run npm run build first, then node tests/cold-assets-server.mjs.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../dist', import.meta.url))
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
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
