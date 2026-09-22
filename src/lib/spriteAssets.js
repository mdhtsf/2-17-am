// Session-local decode cache. A failed asset never replaces a visible sprite.
const entries = new Map()
const listeners = new Set()
export const subscribeSprites = listener => { listeners.add(listener); return () => listeners.delete(listener) }
export const spriteReady = src => entries.get(src)?.ready === true
export function loadSprite(src) {
  if (entries.has(src)) return entries.get(src).promise
  const image = new Image()
  const entry = { image, ready: false, promise: null }
  entries.set(src, entry)
  entry.promise = new Promise(resolve => {
    image.onload = async () => {
      try {
        await image.decode()
        entry.ready = true
        listeners.forEach(listener => listener())
        resolve(true)
      } catch { resolve(false) }
    }
    image.onerror = () => resolve(false)
    image.src = src
  })
  return entry.promise
}
