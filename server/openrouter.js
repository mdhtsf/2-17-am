import { getCharacterPrompt } from './characters.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'openrouter/free'

// Only these curated messages may cross the server boundary, never upstream errors.
export class DialogueServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function replyToNpc({ npc, message, history }) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new DialogueServiceError(503, '对话服务尚未配置，请设置服务器环境变量 OPENROUTER_API_KEY。')
  }

  const signal = AbortSignal.timeout(45000)
  let response
  let data
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: getCharacterPrompt(npc.id) },
          ...history.map(({ role, content }) => ({ role, content })),
          { role: 'user', content: message }],
        stream: false,
        max_tokens: 512,
        reasoning: { enabled: false, exclude: true },
      }),
      signal,
    })
    if (!response.ok) {
      // Do not parse, log, or relay upstream error bodies.
      await response.body?.cancel()
      throw new DialogueServiceError(502, '对话服务暂时不可用，请稍后再试。')
    }
    data = await response.json()
  } catch (error) {
    if (error instanceof DialogueServiceError) throw error
    if (signal.aborted) throw new DialogueServiceError(504, '回复等得有点久，请稍后再试。')
    throw new DialogueServiceError(502, '暂时无法取得回复，请稍后再试。')
  }

  const reply = data?.choices?.[0]?.message?.content
  // Some routed models put analysis/classification in content despite exclude=true.
  // Reject recognizable non-dialogue output; never cut it into a partial sentence.
  const nonDialogue = typeof reply === 'string' &&
    /<\/?(?:think|analysis|reasoning)\b|^\s*(?:here(?:'s| is) (?:a |my |the )?(?:thinking process|analysis)|(?:user|response) safety\s*:|(?:思考过程|分析过程)\s*[:：]|这里玩家在问|按照角色设定)/im.test(reply)
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 4000 || nonDialogue) {
    throw new DialogueServiceError(502, '这次没有收到有效回复，请再试一次。')
  }
  // No provider metadata, reasoning, or raw JSON is returned to the game.
  return reply.trim()
}
