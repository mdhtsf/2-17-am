import { sanitizeSocialDialogue } from '../../shared/socialDialogue.js'

export async function requestSocialDialogue(context, signal) {
  const response = await fetch('/api/social-chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context), signal,
  })
  const localDetail = detail => import.meta.env.DEV ? { detail } : {}
  if (!response.ok) return { source: 'fallback', reason: 'api_http_error', ...localDetail(`Local social API HTTP ${response.status}`) }
  let body
  try { body = await response.json() } catch {
    return { source: 'fallback', reason: 'api_json_error', ...localDetail('Local social API did not return JSON') }
  }
  // Detailed provider diagnostics are never rendered or retained in production.
  const debug = import.meta.env.DEV ? { detail: body.detail, diagnostics: body.diagnostics } : {}
  const dialogue = sanitizeSocialDialogue(body)
  return dialogue ? { ...dialogue, source: 'llm', reason: null, ...debug }
    : { source: 'fallback', reason: body.source === 'fallback' && typeof body.reason === 'string' ? body.reason.slice(0, 80) : 'schema_validation_error', ...debug }
}
