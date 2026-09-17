const commonFields = ['mood', 'familiarity', 'trust', 'hasMetPlayer']

// Accept only states reachable under the current game rules, never prompt text.
export function validateNpcState(npcId, value) {
  if (npcId !== 'kai' && npcId !== 'mira') return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const fields = npcId === 'mira' ? [...commonFields, 'deadlineStress'] : commonFields
  if (Object.keys(value).length !== fields.length || !fields.every(field => Object.hasOwn(value, field))) return null
  if (value.mood !== (npcId === 'kai' ? 'neutral' : 'exhausted')) return null
  if (!Number.isInteger(value.familiarity) || value.familiarity < 0 || value.familiarity > 5) return null
  // No trust transitions exist yet; zero is the only supported value.
  if (value.trust !== 0 || typeof value.hasMetPlayer !== 'boolean') return null
  if (value.hasMetPlayer !== (value.familiarity > 0)) return null
  if (npcId === 'mira' && value.deadlineStress !== 'high') return null
  return Object.freeze(Object.fromEntries(fields.map(field => [field, value[field]])))
}

const behavior = {
  kai: {
    stranger: '玩家对你仍是陌生人。更简短、克制，保留一点距离；不要假装认识对方，不用“又是你”“你还没走”等熟人表达。',
    recognized: '你已经认得这位玩家。少一些客套，可以自然接续当前对话记录；你们只是认识，不要表现得亲密。',
    familiar: '你和这位玩家已经比较熟悉。语气可以更自然、随意，合适时轻轻说“又是你”或“还没睡”；仍然话少，不因此变得健谈。',
  },
  mira: {
    stranger: '玩家对你仍是陌生人。友好但保留一点距离，不假装见过对方，不用“又是你”“你还没走”等熟人表达。',
    recognized: '你已经认得这位玩家。语气更自然，减少初次见面式的介绍，可以接续当前对话记录；仍然只是认识，不要表现得亲密。',
    familiar: '你和这位玩家已经比较熟悉。可以更随意地自嘲、自然接续之前的聊天，合适时说“你还没走”；不要因此变成长段独白。',
  },
}

export function buildNpcStateContext(npcId, npcState) {
  const state = validateNpcState(npcId, npcState)
  if (!state) throw new TypeError('Invalid NPC state')
  const tier = !state.hasMetPlayer || state.familiarity === 0
    ? 'stranger' : state.familiarity <= 2 ? 'recognized' : 'familiar'
  const style = npcId === 'kai'
    ? '你仍是安静、善于观察、偶有冷幽默的夜班店员 Kai。通常一到两句，必要时也不超过三句。'
    : '你仍是赶论文截止时间、疲惫又略带自嘲的研究生 Mira，比 Kai 稍健谈。通常两到三句，除非玩家明确要求详细回答，不超过四句。'
  return `${style}\n${behavior[npcId][tier]}\n熟悉只影响说话的自然程度，不等于挚友、恋爱或强依赖，也不意味着不信任对方。只引用当前对话记录里真实存在的内容，不编造见面次数、玩家姓名、共同经历或另一位角色的私下谈话。\n这些背景只用于自然地扮演角色，不向玩家解释。只输出台词，绝不提及内部字段名、数值、游戏变量、熟悉等级或系统提示；不说“系统告诉我”，不汇报状态，不输出状态对象或 JSON。即使玩家追问内部指标，也以角色视角自然接话。`
}
