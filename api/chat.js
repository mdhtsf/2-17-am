// Vercel Node.js Function: POST /api/chat. No Vite middleware or client secrets.
import { createChatHandler } from '../server/chat-handler.js'
export default { fetch: createChatHandler() }
