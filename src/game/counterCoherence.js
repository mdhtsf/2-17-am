import { SOCIAL_CLIENT_TIMEOUT_MS } from '../../shared/socialTiming.js'
import { sanitizeSocialDialogue } from '../../shared/socialDialogue.js'
import { finiteActivityDurations } from '../../shared/npcActivities.js'
import { COUNTER_SOCIAL, counterConversations } from '../data/counterConversations.js'
import { getNpcSceneLocation } from './npcSceneLocation.js'

// Two bounded counter behaviors sharing the Director's existing major-event gate.
// Generation runs alongside approach; only the request deadline can time out generation; arrival never cancels it.
export function createCounterCoherence({ director, getActivities, assign, onSpeech, generate = null, onDebug = () => {},
  random = Math.random, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
  let running = false, locked = [], pendingReturn = null, returning = false
  let social = null, opportunity = null, lineTimer = null, lastExchange = null, recentExchanges = [], requestTimer = null
  let attemptNumber = 0
  const movements = new Map()
  const delay = range => range[0] + Math.floor(random() * (range[1] - range[0] + 1))
  const arrived = (id, destination) => movements.get(id)?.phase === 'idle' && movements.get(id)?.destination === destination
  const clearLine = () => { if (lineTimer !== null) clearTimer(lineTimer); lineTimer = null; onSpeech(null) }
  const clearRequestTimer = () => { if (requestTimer !== null) clearTimer(requestTimer); requestTimer = null }
  const debug = (phase, extra = {}) => onDebug({ phase, attempt: social?.attempt, ...extra })
  const endSocial = () => { social?.request?.abort(); clearRequestTimer(); clearLine(); debug('finished'); social = null; director.release('counter-social') }

  function advance() {
    if (!running) return
    const activities = getActivities()
    if (returning && (activities.kai !== 'behind_counter' || arrived('kai', 'counter'))) {
      returning = false
      director.release('counter-return')
    }
    if (pendingReturn && activities.kai !== pendingReturn) pendingReturn = null
    if (pendingReturn && !locked.includes('kai') && director.reserve('counter-return')) {
      pendingReturn = null
      returning = true
      assign('kai', 'behind_counter')
    }
    if (!social) return
    if (activities.mira !== 'talking_to_kai' && social.phase !== 'leaving') { endSocial(); return }
    if (activities.kai !== 'behind_counter' || locked.includes('kai') || locked.includes('mira')) {
      social.request?.abort()
      clearRequestTimer()
      debug('interrupted')
      clearLine()
      social.phase = 'leaving'
    }
    if (social.phase === 'leaving') {
      if (locked.includes('mira')) return
      if (activities.mira === 'talking_to_kai') { assign('mira', social.previous); return }
      if (arrived('mira', getNpcSceneLocation('mira', activities.mira))) endSocial()
    } else if (social.phase === 'approaching' && arrived('mira', 'counter_chat') && arrived('kai', 'counter')) {
      social.phase = 'waiting'
      if (!social.pending) beginSpeech()
      else debug('waiting')
    }
  }
  function beginSpeech() {
    if (!social || social.phase !== 'waiting') return
    clearRequestTimer()
    social.phase = 'speaking'
    if (social.generated) recentExchanges = [...recentExchanges, social.generated].slice(-3)
    debug('speaking', { source: social.generated ? 'llm' : 'fallback', reason: social.generated ? null : social.reason,
      detail: social.detail, diagnostics: social.diagnostics, lines: social.exchange.lines, elapsedMs: Date.now() - social.startedAt })
    showLine()
  }
  function showLine() {
    if (!running || !social || social.phase !== 'speaking') return
    const current = social
    const line = current.exchange.lines[current.index]
    if (!line) { clearLine(); current.phase = 'leaving'; advance(); return }
    const index = current.index
    onSpeech({ ...line, key: `${current.exchange.id}:${current.index}` })
    lineTimer = setTimer(() => {
      if (!running || social !== current || current.phase !== 'speaking' || current.index !== index) return
      lineTimer = null
      current.index++
      showLine()
    }, delay(COUNTER_SOCIAL.lineMs))
  }
  function scheduleOpportunity() {
    if (!running || opportunity !== null) return
    const token = {}
    const timer = setTimer(() => {
      if (!running || opportunity?.token !== token) return
      opportunity = null
      const activities = getActivities()
      if (!social && !returning && !pendingReturn && !locked.includes('kai') && !locked.includes('mira')
        && activities.mira !== 'talking_to_kai' && activities.kai === 'behind_counter' && arrived('kai', 'counter')
        && director.reserve('counter-social')) {
        const pool = counterConversations.filter(exchange => exchange.id !== lastExchange)
        const exchange = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
        lastExchange = exchange.id
        social = { attempt: ++attemptNumber, phase: 'approaching', previous: activities.mira, exchange, index: 0, pending: Boolean(generate), reason: 'unavailable', startedAt: Date.now() }
        const current = social
        current.request = new AbortController()
        debug('approaching')
        assign('mira', 'talking_to_kai')
        if (generate) {
          debug('request_started')
          requestTimer = setTimer(() => {
            requestTimer = null
            if (!running || social !== current || !current.pending) return
            current.reason = 'timeout'
            current.detail = `Client request exceeded ${SOCIAL_CLIENT_TIMEOUT_MS / 1000} seconds`
            current.pending = false
            current.request.abort()
            debug('response_received', { source: 'fallback', reason: current.reason, detail: current.detail })
            beginSpeech()
          }, SOCIAL_CLIENT_TIMEOUT_MS)
          const context = { kaiActivity: activities.kai, miraActivity: 'talking_to_kai', miraPreviousActivity: current.previous, recentExchanges }
          Promise.resolve().then(() => {
            if (current.request.signal.aborted) return null
            return generate(context, current.request.signal)
          }).then(result => {
            if (!running || social !== current || !['approaching', 'waiting'].includes(current.phase) || current.request.signal.aborted) return
            const validated = sanitizeSocialDialogue(result)
            const signature = validated && JSON.stringify(validated.lines)
            clearRequestTimer()
            current.pending = false
            current.detail = result?.detail
            current.diagnostics = result?.diagnostics
            current.reason = result?.reason || 'invalid_output'
            if (validated && !recentExchanges.some(exchange => JSON.stringify(exchange.lines) === signature)) {
              current.generated = validated
              current.exchange = { id: 'generated', lines: validated.lines.map(({ speaker, text }) => ({ npcId: speaker, text })) }
            } else if (validated) { current.reason = 'invalid_response'; current.detail = 'Generated exchange exactly repeats recent dialogue' }
            debug('response_received', { source: current.generated ? 'llm' : 'fallback', reason: current.generated ? null : current.reason, detail: current.detail, diagnostics: current.diagnostics, elapsedMs: Date.now() - current.startedAt })
            beginSpeech()
          }).catch(() => {
            if (!running || social !== current || current.request.signal.aborted) return
            clearRequestTimer()
            current.pending = false; current.reason = 'network_error'; current.detail = 'Browser could not reach the social API'
            debug('response_received', { source: 'fallback', reason: current.reason, detail: current.detail })
            beginSpeech()
          })
        }
      }
      // Busy opportunities are skipped, never queued to compete on every idle tick.
      scheduleOpportunity()
    }, delay(COUNTER_SOCIAL.opportunityMs))
    opportunity = { timer, token }
  }
  return {
    start() { running = true; scheduleOpportunity(); advance() },
    stop() {
      running = false
      if (opportunity) clearTimer(opportunity.timer)
      opportunity = null
      social?.request?.abort()
      clearRequestTimer()
      clearLine()
      social = null; pendingReturn = null; returning = false
      director.release('counter-social'); director.release('counter-return')
    },
    complete(id, activity) { if (finiteActivityDurations[id]?.[activity] && getActivities().kai === activity) { pendingReturn = activity; advance() } },
    report(id, movement) { movements.set(id, movement); advance() },
    setInteractionLocks(ids) { locked = ids; advance() },
  }
}
