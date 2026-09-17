export async function sendChat({ npc, message, history, npcState, signal }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc, message, history, npcState }),
    signal,
  })
  // A Vite-only server can return HTML: treat it as a failure, never NPC dialogue.
  const data = await response.json().catch(() => null)
  if (!response.ok || typeof data?.reply !== 'string' || !data.reply.trim()) {
    throw new Error('Dialogue request failed')
  }
  return data.reply
}
