// Brief in-world feedback for a slow player request, not a successful API turn.
// Keep these separate from server/provider fallback replies and conversation history.
const slowReplyLines = {
  kai: ['……雨声有点大。你刚说什么？', '刚才没听清。再说一遍。', '嗯？后半句被雨盖住了。'],
  mira: ['刚才那句被雨盖过去了，再说一遍？', '抱歉，刚走了下神。你说到哪儿了？', '我好像漏听了半句。今晚耳朵也想先下班。'],
}

export function slowReplyLine(npcId, random = Math.random) {
  const lines = slowReplyLines[npcId] || slowReplyLines.kai
  return lines[Math.floor(random() * lines.length)]
}
