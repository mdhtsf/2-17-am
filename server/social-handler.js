import { SocialGenerationError, socialDebugEnabled, safeSocialDetail } from './social-transport.js'
import { generateSocialDialogue, validSocialContext } from './social-dialogue.js'
import { sanitizeSocialDialogue, sanitizeRecentExchanges } from '../shared/socialDialogue.js'

export function createSocialHandler(provider = generateSocialDialogue) {
  return async request => {
    const respond = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
    if (request.method !== 'POST') return respond(405, { error: 'POST required' })
    let body
    try { body = await request.json() } catch { return respond(400, { error: 'Invalid JSON' }) }
    if (!validSocialContext(body)) return respond(400, { error: 'Invalid social context' })
    // Explicit projection: client prose, prompts and rendering data never enter generation.
    const recentExchanges = sanitizeRecentExchanges(body.recentExchanges)
    if (!recentExchanges) return respond(400, { error: 'Invalid recent exchanges' })
    const { kaiActivity, miraActivity, miraPreviousActivity } = body
    const startedAt = Date.now()
    const diagnostics = []
    const report = event => { if (socialDebugEnabled()) diagnostics.push({ ...event, elapsedMs: Date.now() - startedAt }) }
    const debug = () => socialDebugEnabled() ? { diagnostics } : {}
    try {
      const result = sanitizeSocialDialogue(await provider({ kaiActivity, miraActivity, miraPreviousActivity, ...(recentExchanges.length ? { recentExchanges } : {}) }, request.signal, report))
      if (!result) throw new SocialGenerationError('schema_validation_error', 'Provider result does not match social dialogue schema')
      return respond(200, { ...result, source: 'llm', reason: null, ...debug() })
    } catch (error) {
      const reason = error instanceof SocialGenerationError ? error.reason : 'internal_error'
      const detail = error instanceof SocialGenerationError ? safeSocialDetail(error.message) : 'Unexpected social generation failure'
      report({ event: 'failed', reason, detail })
      return respond(200, { fallback: true, source: 'fallback', reason, ...(socialDebugEnabled() ? { detail } : {}), ...debug() })
    }
  }
}
