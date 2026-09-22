import { scene } from '../data/scene.js'

// Shared human cadence in art-space pixels, independent of viewport size.
export const HUMAN_MOVEMENT = Object.freeze({
  pixelsPerSecond: 155,
  minDurationMs: 500,
  maxDurationMs: 8000,
  frames: 4,
  fps: 8,
  settleMs: 125,
  completionGraceMs: 80,
})
export const KAI_MOVEMENT = HUMAN_MOVEMENT // Keep the accepted Kai contract stable.
export const WALK_FRAME_MS = 1000 / HUMAN_MOVEMENT.fps
export const WALK_CYCLE_MS = WALK_FRAME_MS * HUMAN_MOVEMENT.frames

export function getMovementDistance(previous, target) {
  return Math.hypot((target.x - previous.x) * scene.width / 100,
    (target.y - previous.y) * scene.height / 100)
}

export function getMovementDuration(previous, target, config = HUMAN_MOVEMENT) {
  const distance = getMovementDistance(previous, target)
  if (!distance) return 0
  const rawMs = distance / config.pixelsPerSecond * 1000
  // End on a complete four-frame cycle rather than cutting off a lifted foot.
  const cycleMs = 1000 / config.fps * config.frames
  const fullCycles = Math.round(rawMs / cycleMs) * cycleMs
  return Math.min(config.maxDurationMs, Math.max(config.minDurationMs, fullCycles))
}

export function getMovementDirection(previous, target) {
  const dx = (target.x - previous.x) * scene.width
  const dy = (target.y - previous.y) * scene.height
  if (dx === 0 && dy === 0) return null
  // One facing per segment; ties deliberately favor the horizontal axis.
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'back' : 'front'
}
