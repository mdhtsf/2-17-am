import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { loadSprite, spriteReady, subscribeSprites } from '../lib/spriteAssets.js'

// Keep one drawable descriptor until the requested source is fully decoded.
// Descriptor includes the crop/direction, so a delayed old request cannot win.
export function useLoadedSprite(target, fallback) {
  const ready = useSyncExternalStore(subscribeSprites, () => spriteReady(target.src), () => false)
  const retained = useRef(fallback)
  useEffect(() => { loadSprite(target.src) }, [target.src])
  useLayoutEffect(() => { if (ready) retained.current = target }, [ready, target])
  return ready ? target : retained.current
}
