// Curated fallback for failed or unfinished ambient generation. No player history.
export const COUNTER_SOCIAL = Object.freeze({ opportunityMs: [90000, 180000], lineMs: [2200, 2800] })
export const counterConversations = Object.freeze([
  { id: 'coffee', lines: [
    { npcId: 'mira', text: '这杯算明天的咖啡吗？' },
    { npcId: 'kai', text: '账上算今天。' },
    { npcId: 'mira', text: '那今天还挺长的。' },
  ] },
  { id: 'paragraph', lines: [
    { npcId: 'mira', text: '我又删掉了一段。' },
    { npcId: 'kai', text: '至少文件变小了。' },
    { npcId: 'mira', text: '嗯。也算有进度。' },
  ] },
  { id: 'rain', lines: [
    { npcId: 'mira', text: '雨是不是小了一点？' },
    { npcId: 'kai', text: '刚才也小过。' },
    { npcId: 'mira', text: '那我再等一会儿。' },
    { npcId: 'kai', text: '门还开着。' },
  ] },
])
