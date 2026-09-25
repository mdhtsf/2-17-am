import { worldEventIds } from '../../shared/worldEvents.js'
import { WORLD_EVENTS, worldEventDelay, getWorldReactionCandidates, chooseWorldBark } from '../data/worldEventReactions.js'

// Independent environmental clock; the existing Director owns all movement gates.
export function createWorldEvents({ director, getActivities, assign, onEvent, onSpeech, onDebug = () => {},
  random = Math.random, now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
  let running = false, opportunity = null, expiry = null, lineTimer = null
  let recent = null, reaction = null, locks = [], lastEvent = null, sequence = 0
  const movements = new Map(), lastBarks = new Map()
  const clear = timer => { if (timer !== null) clearTimer(timer) }
  const debug = (reason, bark = null) => onDebug({ event: recent?.id ?? null, responder: reaction?.cancelled ? null : reaction?.npcId ?? null, bark, reason })
  function endReaction() {
    if (!reaction) return
    clear(lineTimer); lineTimer = null
    onSpeech(null)
    // React may not have reported the dispatched movement yet. Keep its gate
    // until a real movement report takes over, even if this event is superseded.
    if (running && reaction.dispatched && !reaction.movementObserved) {
      reaction.cancelled = true
      return
    }
    reaction = null
    director.release('world-event')
  }
  function settle() {
    const current = reaction
    if (!current) return
    if (current.cancelled) { endReaction(); return }
    if (locks.includes(current.npcId) || getActivities()[current.npcId] !== current.activity) { endReaction(); return }
    if (current.settled) return
    const movement = movements.get(current.npcId)
    if (movement?.phase !== 'idle' || movement.destination !== current.destination) return
    current.settled = true
    const key = `${recent.id}:${current.npcId}`
    const bark = current.npcId !== 'cat' && random() < WORLD_EVENTS.barkProbability
      ? chooseWorldBark(recent.id, current.npcId, lastBarks.get(key), random) : null
    debug('settled', bark)
    if (!bark) { endReaction(); return }
    lastBarks.set(key, bark)
    onSpeech({ npcId: current.npcId, text: bark, key: `world:${recent.sequence}` })
    lineTimer = setTimer(() => {
      if (!running || reaction !== current) return
      endReaction(); debug('bark_finished')
    }, WORLD_EVENTS.barkMs)
  }
  function schedule() {
    clear(opportunity?.timer)
    if (!running) return
    const ticket = {}
    opportunity = ticket
    ticket.timer = setTimer(() => {
      if (!running || opportunity !== ticket) return
      opportunity = null
      const pool = worldEventIds.filter(id => id !== lastEvent)
      trigger(pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))])
    }, worldEventDelay(random))
  }
  function trigger(id) {
    if (!worldEventIds.includes(id)) throw new RangeError('Invalid world event')
    if (!running) return
    endReaction(); clear(expiry)
    recent = { id, expiresAt: now() + WORLD_EVENTS.lifetimeMs, sequence: ++sequence }
    lastEvent = id
    const ownEvent = recent
    onEvent(recent)
    expiry = setTimer(() => {
      if (!running || recent !== ownEvent) return
      endReaction(); recent = null; expiry = null; onEvent(null); debug('expired')
    }, WORLD_EVENTS.lifetimeMs)
    const candidates = getWorldReactionCandidates(id, getActivities(), movements, locks)
    if (!candidates.length) debug('no_responder')
    else if (random() >= WORLD_EVENTS.reactionProbability) debug('environment_only')
    else if (!director.reserve('world-event')) debug('busy')
    else {
      reaction = { ...candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))], settled: false }
      debug('reacting')
      if (getActivities()[reaction.npcId] !== reaction.activity) {
        reaction.dispatched = true
        assign(reaction.npcId, reaction.activity)
      }
      settle()
    }
    schedule()
  }
  return {
    start() { if (running) return; running = true; schedule() },
    stop() {
      running = false; clear(opportunity?.timer); opportunity = null
      clear(expiry); expiry = null; endReaction(); recent = null; onEvent(null)
    },
    trigger,
    getRecentWorldEvent: () => recent && now() < recent.expiresAt ? recent.id : undefined,
    report(id, movement) {
      movements.set(id, movement)
      if (reaction?.npcId === id && (movement.phase !== 'idle' ||
          movement.destination === reaction.destination || getActivities()[id] !== reaction.activity)) {
        reaction.movementObserved = true
      }
      settle()
    },
    setInteractionLocks(ids) { locks = ids; if (reaction && locks.includes(reaction.npcId)) endReaction() },
  }
}
