import { scene } from '../data/scene.js'

// Art-space pixels, independent of viewport size. Only Kai uses this timing.
export const KAI_MOVEMENT = Object.freeze({
  pixelsPerSecond: 155,
  minDurationMs: 500,
  maxDurationMs: 8000,
  frames: 4,
  fps: 8,
  settleMs: 125,
  completionGraceMs: 80,
})
export const WALK_FRAME_MS = 1000 / KAI_MOVEMENT.fps
export const WALK_CYCLE_MS = WALK_FRAME_MS * KAI_MOVEMENT.frames

export function getMovementDistance(previous, target) {
  return Math.hypot((target.x - previous.x) * scene.width / 100,
    (target.y - previous.y) * scene.height / 100)
}

export function getMovementDuration(previous, target) {
  const distance = getMovementDistance(previous, target)
  if (!distance) return 0
  const rawMs = distance / KAI_MOVEMENT.pixelsPerSecond * 1000
  // End on a complete four-frame cycle rather than cutting off a lifted foot.
  const fullCycles = Math.round(rawMs / WALK_CYCLE_MS) * WALK_CYCLE_MS
  return Math.min(KAI_MOVEMENT.maxDurationMs, Math.max(KAI_MOVEMENT.minDurationMs, fullCycles))
}

export function getMovementDirection(previous, target) {
  const dx = (target.x - previous.x) * scene.width
  const dy = (target.y - previous.y) * scene.height
  if (dx === 0 && dy === 0) return null
  // One facing per segment; ties deliberately favor the horizontal axis.
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'back' : 'front'
}
