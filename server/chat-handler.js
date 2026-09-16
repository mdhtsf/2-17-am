import { npcs, MAX_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES } from '../shared/npcs.js'
import { replyToNpc, DialogueServiceError } from './openrouter.js'

function validHistory(history) {
  return Array.isArray(history) && history.length <= MAX_HISTORY_MESSAGES &&
    history.length % 2 === 0 && history.every((entry, index) =>
      entry && entry.role === (index % 2 ? 'assistant' : 'user') &&
      typeof entry.content === 'string' && entry.content.trim().length > 0 &&
      entry.content.length <= 4000)
}

// A factory lets tests exercise provider failures without adding a test-only API flag.
export function createChatHandler(provider = replyToNpc) {
  return async function handler(req) {
    const respond = (status, data, headers = {}) => Response.json(data, {
      status, headers: { 'Cache-Control': 'no-store', ...headers },
    })
    if (req.method !== 'POST') {
      return respond(405, { error: '请使用 POST 请求。' }, { Allow: 'POST' })
    }
    try {
      let body
      try {
        body = await req.json()
      } catch {
        return respond(400, { error: '请求必须包含有效的 JSON。' })
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: '请求必须包含 JSON 对象。' })
      }
      const { npc, message, history = [] } = body
      if (typeof npc !== 'string' || !Object.hasOwn(npcs, npc)) {
        return respond(400, { error: '这里没有这位对话角色。' })
      }
      if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
        return respond(400, { error: `请输入 1–${MAX_MESSAGE_LENGTH} 个字符。` })
      }
      if (!validHistory(history)) {
        return respond(400, { error: '对话记录格式不正确。' })
      }
      const reply = await provider({
        npc: npcs[npc], message: message.trim(),
        history: history.map(({ role, content }) => ({ role, content })),
      })
      if (typeof reply !== 'string' || !reply.trim() || reply.length > 4000) {
        throw new Error('Invalid provider reply')
      }
      return respond(200, { reply })
    } catch (error) {
      if (error instanceof DialogueServiceError) {
        return respond(error.status, { error: error.message })
      }
      return respond(500, { error: '暂时没有听清，请稍后再试。' })
    }
  }
}
