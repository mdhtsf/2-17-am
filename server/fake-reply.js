// Stage 2.2 replaces only this server-side provider boundary.
// message/history are accepted now but deliberately do not drive an LLM yet.
export async function replyToNpc({ npc, message, history }) {
  const replies = {
    kai: '夜班。总得有人醒着。',
    mira: '论文还没写完。准确地说，是我还不愿意承认它没写完。',
  }
  return replies[npc.id]
}
