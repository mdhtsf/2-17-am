import { getCharacterPrompt } from './characters.js'
import { sceneTone } from './scene-tone.js'
import { buildNpcActivityContext } from './npc-activity-context.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Only these curated messages may cross the server boundary, never upstream errors.
export class DialogueServiceError extends Error {
  constructor(status, message, retryable = false) {
    super(message)
    this.status = status
    this.retryable = retryable
  }
}

function shouldFallback(status, error) {
  if ([502, 503, 504].includes(status)) return true
  if (![429, 500, 529].includes(status)) return false

  const metadata = error?.metadata
  if (!metadata || metadata.is_byok === true) return false
  // An explicit but unknown/account-level source must not be overridden by a
  // provider name or a vague "rate limited" message. Never guess from raw text.
  if (metadata.limit_source !== undefined) {
    return ['upstream_provider_shared_pool', 'provider_overloaded',
      'provider_temporary_rate_limit'].includes(metadata.limit_source)
  }
  return ['provider_overloaded', 'provider_unavailable',
    'provider_temporary_rate_limit'].includes(metadata.error_type)
}

function isNetworkFailure(error) {
  const code = error?.cause?.code
  if (code !== undefined) {
    return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND',
      'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)
  }
  return error instanceof TypeError && /^(fetch failed|failed to fetch|networkerror when attempting to fetch resource\.?|load failed)$/i.test(error.message)
}

async function requestModel(model, generation, apiKey, signal) {
  // Serialize outside the transport catch: programming errors cannot trigger fallback.
  const body = JSON.stringify({ model, ...generation })
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw new DialogueServiceError(504, '回复等得有点久，请稍后再试。')
    throw new DialogueServiceError(502, '暂时无法取得回复，请稍后再试。', isNetworkFailure(error))
  }

  let data
  try {
    // Metadata is inspected only on the server and is never logged or returned.
    data = await response.json()
  } catch (error) {
    if (signal.aborted) throw new DialogueServiceError(504, '回复等得有点久，请稍后再试。')
    if (response.ok) {
      throw new DialogueServiceError(502, '暂时无法取得回复，请稍后再试。', isNetworkFailure(error))
    }
    // Non-JSON 502/503/504 responses can still be classified by HTTP status.
  }
  if (!response.ok || data?.error) {
    // OpenRouter can also report generation failures in an HTTP 200 error body.
    const status = response.ok ? data.error.code : response.status
    throw new DialogueServiceError(502, '对话服务暂时不可用，请稍后再试。', shouldFallback(status, data?.error))
  }

  const reply = data?.choices?.[0]?.message?.content
  // Some models put analysis/classification in content despite reasoning being disabled.
  // Reject recognizable non-dialogue output; never cut it into a partial sentence.
  const nonDialogue = typeof reply === 'string' &&
    /<\/?(?:think|analysis|reasoning)\b|^\s*(?:here(?:'s| is) (?:a |my |the )?(?:thinking process|analysis)|(?:user|response) safety\s*:|(?:思考过程|分析过程)\s*[:：]|这里玩家在问|按照角色设定)/im.test(reply)
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 4000 || nonDialogue) {
    throw new DialogueServiceError(502, '这次没有收到有效回复，请再试一次。')
  }
  // No provider metadata, reasoning, or raw JSON is returned to the game.
  return reply.trim()
}

export async function replyToNpc({ npc, message, history, activity }) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new DialogueServiceError(503, '对话服务尚未配置，请设置服务器环境变量 OPENROUTER_API_KEY。')
  }
  const primaryModel = process.env.OPENROUTER_MODEL || 'openrouter/free'
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || null
  const activityContext = buildNpcActivityContext(npc.id, activity)
  const generation = {
    messages: [{ role: 'system', content: getCharacterPrompt(npc.id) },
      { role: 'system', content: sceneTone },
      ...(activityContext ? [{ role: 'system', content: activityContext }] : []),
      ...history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: message }],
    stream: false,
    max_tokens: 512,
    reasoning: { enabled: false },
  }
  // One shared budget keeps both attempts within the existing frontend timeout.
  const signal = AbortSignal.timeout(45000)
  try {
    return await requestModel(primaryModel, generation, apiKey, signal)
  } catch (error) {
    if (!(error instanceof DialogueServiceError) || !error.retryable ||
        !fallbackModel || fallbackModel === primaryModel || signal.aborted) throw error
    return requestModel(fallbackModel, generation, apiKey, signal)
  }
}
