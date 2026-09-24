import { SOCIAL_SERVER_TIMEOUT_MS } from '../shared/socialTiming.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
export class SocialGenerationError extends Error {
  constructor(reason, detail) { super(detail); this.reason = reason }
}

// Diagnostics are opt-in and local only. Never return keys, full model output,
// provider metadata/raw bodies or reasoning. Player dialogue uses its own transport.
export function socialDebugEnabled() {
  return process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production' &&
    (process.env.NODE_ENV === 'development' || process.env.SOCIAL_CHAT_DEBUG === '1')
}
export function safeSocialDetail(value) {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  return String(value || '').split(key || '\u0000NO_KEY\u0000').join('[redacted]')
    .replace(/Bearer\s+\S+|sk-[\w-]+/gi, '[redacted]').replace(/[\u0000-\u001f]/g, ' ').slice(0, 300)
}

export async function requestSocialModel(generation, requestSignal, report = () => {}) {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  const model = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free'
  report({ event: 'request_started', model, endpoint: ENDPOINT, keyConfigured: Boolean(key) })
  if (!key) throw new SocialGenerationError('missing_api_key', 'Server OPENROUTER_API_KEY is not configured')
  const timeout = AbortSignal.timeout(SOCIAL_SERVER_TIMEOUT_MS)
  const signal = requestSignal ? AbortSignal.any([timeout, requestSignal]) : timeout
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, ...generation }), signal,
    })
    report({ event: 'response_received', httpStatus: response.status })
    let data
    try { data = await response.json() } catch (error) {
      if (signal.aborted) throw error
      if (!response.ok) throw new SocialGenerationError('openrouter_http_error', `HTTP ${response.status}; non-JSON error body`)
      throw new SocialGenerationError('response_json_error', `HTTP ${response.status}; response envelope is not valid JSON`)
    }
    if (!response.ok || data?.error) {
      const providerCode = data?.error?.code
      const detail = safeSocialDetail(data?.error?.message || response.statusText)
      report({ event: 'provider_error', httpStatus: response.status, providerCode: typeof providerCode === 'number' ? providerCode : undefined, detail })
      throw new SocialGenerationError(response.ok ? 'openrouter_provider_error' : 'openrouter_http_error',
        `HTTP ${response.status}${providerCode ? `; provider ${providerCode}` : ''}: ${detail}`)
    }
    const choice = data?.choices?.[0]
    const content = choice?.message?.content
    report({ event: 'content_received', finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason.slice(0, 40) : null,
      contentLength: typeof content === 'string' ? content.length : null })
    if (choice?.finish_reason === 'length') throw new SocialGenerationError('truncated_response', 'Completion exhausted its output token budget')
    if (typeof content !== 'string' || !content.trim() || content.length > 4000) {
      throw new SocialGenerationError('invalid_response', 'Expected nonempty choices[0].message.content, at most 4000 characters')
    }
    return content.trim()
  } catch (error) {
    if (timeout.aborted) throw new SocialGenerationError('timeout', `Server request exceeded ${SOCIAL_SERVER_TIMEOUT_MS / 1000} seconds`)
    if (requestSignal?.aborted) throw new SocialGenerationError('request_cancelled', 'Client disconnected or cancelled this event')
    if (error instanceof SocialGenerationError) throw error
    throw new SocialGenerationError('network_error', safeSocialDetail(`${error?.cause?.code || ''} ${error?.message || 'Fetch failed'}`))
  }
}
