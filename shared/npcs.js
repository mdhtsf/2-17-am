export const npcs = {
  kai: {
    id: 'kai',
    name: 'KAI',
    dialogueName: 'KAI',
    role: '夜班店员',
    opening: '还没睡？',
    detail: '他把纸杯推过来。你还没开口。',
    replies: [
      { label: '有这么明显吗？', text: '同一张价签，你看了三分钟。咖啡还新鲜——相对来说。' },
      { label: '习惯这个时间了吗？', text: '时间习惯了，人还没有。' },
    ],
  },
  mira: {
    id: 'mira',
    name: 'MIRA',
    dialogueName: 'MIRA',
    role: '再写一段就好',
    opening: '你看起来也没怎么睡。',
    detail: '她揉了揉眼睛，视线在冷柜前停了很久，像是在做今晚最难的一道选择题。',
    replies: [
      { label: '在赶截止时间？', text: '早上九点交。引言改了四遍，我现在特别擅长从头开始。' },
      { label: '怎么会来这里？', text: '住处太安静了。这里有冰箱声和雨声，反而能写下去。' },
    ],
  },
}

export const catFeedback = '猫看了你一眼，然后决定你没什么意思。'

export const MAX_MESSAGE_LENGTH = 1000
export const MAX_HISTORY_MESSAGES = 20
