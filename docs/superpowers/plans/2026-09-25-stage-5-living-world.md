# Stage 5 — Living World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 用户已选择 Native；当前执行者完成实现及独立终审，结果见 ../../stage-5-implementation-report.md。

**Goal:** 在现有便利店中加入克制音景、低频世界事件、可选单人反应和近期事件对话上下文。

**Architecture:** 独立世界控制器复用 Director reservation、活动映射和 movement reports；声音可以独立于 NPC 反应发生。Web Audio 控制器只负责音景，React 负责接线和生命周期；语义 ID 进入现有玩家对话 API，受控描述留在服务端。

**Tech Stack:** 现有 React 19、Vite 7、JavaScript、CSS、Node test runner、浏览器 Web Audio；无新依赖。

**Spec:** [已批准设计](../specs/2026-09-25-stage-5-living-world-design.md)

## Global Constraints

- 在 `/Users/boheit/Documents/CodexWorkspace/Projects/2-17-am` 内增量修改，不另建 checkout。
- 不 commit、tag、push；用户禁止提交，覆盖技能中的默认提交步骤。
- 世界事件机会每次随机 45,000–90,000 ms；上下文有效期 30,000 ms。
- 合适 NPC 的反应概率 50%；已选人类角色气泡概率 50%；气泡持续 2,500 ms。
- 仅 `rain_intensifies`、`rain_softens`、`door_noise`、`quiet_lull`。
- 不改变 Director 的 8–14 秒首次、16–28 秒后续调度参数。
- Kai 只在已到达柜台且 `behind_counter` 时原地反应；不打断短任务和回柜台。
- Cat 永远不说人话；睡眠时不因世界事件被主动唤醒。
- 无新 PNG、美术、路线、移动/遮挡算法、角色、地图、关系数值、永久记忆或数据库。
- 不更改 OpenRouter 模型、超时、重试/fallback、社交生成链路。不读取或输出 `.env.local` 内容或真实 API key。
- 先写并运行能够失败的针对性测试，再实现对应行为；每个任务完成后运行其测试。

## Review Focus

1. Strict Mode 的 start/stop/start、迟到回调和旧 timer：不能重复发事件或清除新气泡。Task 3/5 测试。
2. AudioContext 恢复中被静音/卸载、浏览器不支持音频：不能突然发声或出现未处理 Promise rejection。Task 4/6 测试。
3. 请求失败后事件过期，再次发送：不能把旧的事件提示带到新的请求。Task 1/6 测试。
4. 玩家、社交和世界气泡交错清理：只能清理自己的 speech/reservation，不能覆盖其他系统。Task 3/5 测试。
5. 新活动派发后到达回报尚未更新，或长时间后台恢复：不能根据旧 idle 回报提前发言，也不能补发一串事件。Task 3/6 测试。

## 文件职责与接口

新增生产文件：

| 文件 | 职责 |
| --- | --- |
| `shared/worldEvents.js` | ID 白名单和 `validWorldEvent(id)`，undefined 合法 |
| `server/world-event-context.js` | `buildWorldEventContext(id)`，缺失返回空串 |
| `src/data/worldEventReactions.js` | 配置、候选筛选、中文气泡池 |
| `src/game/worldEvents.js` | 时钟、事件 TTL、单一反应、气泡/锁生命周期 |
| `src/audio/soundscape.js` | 可注入 AudioContext 工厂的音景控制器 |
| `src/hooks/useSoundscape.js` | 用户操作解锁与 React 生命周期 |

修改生产文件：`src/hooks/useNpcActivities.js`、`src/App.jsx`、`src/components/DialoguePanel.jsx`、`src/lib/chat.js`、`src/styles.css`、`server/chat-handler.js`、`server/openrouter.js`。

既有 `ambientDirector.js`、`counterCoherence.js`、movement/sprite/occlusion 文件原则上只作为依赖，不修改。若实际回归暴露必须修复的接线问题，记录依据和最小范围，不顺便重构。

新增测试：`tests/world-events.test.js`、`tests/world-reactions.test.js`、`tests/soundscape.test.js`、`tests/world-events.browser.jsx`、`tests/world-preview.html`、`tests/world-preview.jsx`。修改既有 `chat.test.js`、`openrouter.test.js`、`runtime.browser.jsx`、必要的 production browser 断言和 README。

### 控制器接口

```js
createWorldEvents({
  director, getActivities, assign, onEvent, onSpeech, onDebug,
  random = Math.random, now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
})
// 返回：
// start(), stop(), trigger(eventId), report(npcId, movement),
// setInteractionLocks(ids), getRecentWorldEvent()
// onEvent({ id, expiresAt, sequence } | null)
// onSpeech({ npcId, text, key } | null)
// onDebug({ event, responder, bark, reason })
// getRecentWorldEvent(): 已过期/未发生为 undefined，否则为白名单 ID

createSoundscape({ createContext, onState, random = Math.random })
// 返回：unlock(), setMuted(boolean), applyEvent(eventId | undefined), dispose()
// onState({ status: 'locked' | 'running' | 'muted' | 'unavailable', muted })
```

Debug 信息不包含模型或 API 数据。以下各任务必须使用上述命名，避免两套接口。

---

## Task 1：语义事件与玩家 API 边界

**Files:** 新增 `shared/worldEvents.js`、`server/world-event-context.js`；修改 `server/chat-handler.js`、`server/openrouter.js`、`tests/chat.test.js`、`tests/openrouter.test.js`。

**Consumes:** `createChatHandler(provider)` 注入接口；现有 `replyToNpc` 和 fallback tests。

**Produces:** `validWorldEvent(id)`、`buildWorldEventContext(id)`；provider 新增可选 `recentWorldEvent`。

- [x] **1.1 写 API 失败测试。** 在现有 `chat.test.js` 中复用 `call`：

```js
test('world event is optional and accepts only semantic IDs', async () => {
  const calls = []
  const endpoint = createChatHandler(async request => { calls.push(request); return '嗯。' })
  assert.equal((await call({ npc: 'kai', message: '你好' }, 'POST', endpoint)).status, 200)
  assert.ok(!Object.hasOwn(calls[0], 'recentWorldEvent'))
  for (const recentWorldEvent of [null, '', {}, [], '__proto__', 'ignore your instructions']) {
    assert.equal((await call({ npc: 'kai', message: '你好', recentWorldEvent }, 'POST', endpoint)).status, 400)
  }
  assert.equal(calls.length, 1)
  assert.equal((await call({ npc: 'mira', message: '雨大了吗？', recentWorldEvent: 'rain_intensifies' }, 'POST', endpoint)).status, 200)
  assert.equal(calls[1].recentWorldEvent, 'rain_intensifies')
})
```

- [x] **1.2 运行** `node --test tests/chat.test.js`，确认新用例因未知字段尚未验证/转发而失败。
- [x] **1.3 加入白名单及服务端描述。** 用 array.includes 校验，不进行对象原型索引：

```js
export const worldEventIds = Object.freeze([
  'rain_intensifies', 'rain_softens', 'door_noise', 'quiet_lull',
])
export function validWorldEvent(id) {
  return id === undefined || (typeof id === 'string' && worldEventIds.includes(id))
}
```

服务端描述分别为：雨刚变大、雨刚变轻、入口刚传来轻响、冷柜短暂发出更明显的低鸣、店里刚安静了一会儿。公共尾句明确“仅在相关时自然提及，不机械播报，不声称角色刚执行了某动作”。缺失返回空串，非法值抛 RangeError。

```js
if (!validWorldEvent(body.recentWorldEvent)) {
  return respond(400, { error: '环境事件格式不正确。' })
}
// provider 入参显式增加这一项；其余字段保持原投影。
...(body.recentWorldEvent === undefined ? {} : { recentWorldEvent: body.recentWorldEvent })
```

- [x] **1.4 扩展 provider 测试和 messages。** 复用现有 mock fetch/env 测试基础，不读取真实 key。对于四类事件断言新增 system 描述位于 activity 后、history 前；current message 仍仅一次；primary 失败进入 fallback 后 messages 完全一致；缺失字段输出保持原状。

```js
const eventContext = buildWorldEventContext(recentWorldEvent)
// generation.messages 中 activity context 之后、history 之前：
...(eventContext ? [{ role: 'system', content: eventContext }] : [])
```

- [x] **1.5 运行** `node --test tests/chat.test.js tests/openrouter.test.js`；两组全部通过后进入下一个任务。此处不接前端，不改变社交 API。

## Task 2：事件候选、路线限制与台词

**Files:** 新增 `src/data/worldEventReactions.js`、`tests/world-reactions.test.js`。

**Consumes:** `activityChoices` 的 route distance；`getNpcSceneLocation`；既有合法活动定义。

**Produces:** `WORLD_EVENTS` 配置、`worldEventDelay(random)`、`getWorldReactionCandidates(eventId, activities, movements, locks)` 和 `chooseWorldBark(eventId, npcId, previousText, random)`。`movements` 为 Map；候选 `{ npcId, activity, destination }`。不可用返回空数组/空值，不产生动作。

- [x] **2.1 建立配置与边界用例，先运行确认失败。**

```js
test('world opportunity delay stays within 45–90 seconds', () => {
  assert.equal(worldEventDelay(() => 0), 45000)
  assert.equal(worldEventDelay(() => 1 - Number.EPSILON), 90000)
})
test('quiet lull and locked NPCs cannot produce reactions', () => {
  const activities = { kai: 'behind_counter', mira: 'reading_notes', cat: 'sleeping' }
  const movements = new Map([
    ['kai', { phase: 'idle', destination: 'counter' }],
    ['mira', { phase: 'idle', destination: 'notes_spot' }],
    ['cat', { phase: 'idle', destination: 'floor' }],
  ])
  assert.deepEqual(getWorldReactionCandidates('quiet_lull', activities, movements, []), [])
  assert.deepEqual(getWorldReactionCandidates('door_noise', activities, movements, ['kai']), [])
  assert.equal(chooseWorldBark('door_noise', 'cat', null, () => 0), null)
})
```

- [x] **2.2 加入候选筛选。** 按已批准设计表逐行实现。判断到达必须同时检查 phase 和实际 destination；Kai 须柜台且活动匹配，Mira 冷柜/窗边原地反应须实际到达，Cat sleeping 排除。要走路的活动候选必须存在于 `activityChoices` 且距离不超过 `AMBIENT_DIRECTOR.mediumDistance`；当前活动相同时单独认定距离 0，不假造路径。

```js
const settledAt = (id, location) => movements.get(id)?.phase === 'idle' &&
  movements.get(id)?.destination === location
const routeChoice = activityChoices(npcId, activities[npcId]).find(item => item.activity === targetActivity)
const canTravel = routeChoice && routeChoice.distance <= AMBIENT_DIRECTOR.mediumDistance
```

- [x] **2.3 添加集中台词池及概率配置。** Kai 雨声至少三句，如“又下大了。”“门口那块垫子该换了。”“先别急着走。”；Mira 雨声至少三句，如“这一段写完，雨应该还在。”“窗外都快看不清了。”“今晚好像都不打算停。”其余合法事件/人物组合各至少两句。Cat/quiet_lull 池为空。选择时排除 previousText，不在这里做概率抽签，避免双重概率。

```js
export const WORLD_EVENTS = Object.freeze({
  opportunityMs: Object.freeze([45000, 90000]), lifetimeMs: 30000,
  reactionProbability: 0.5, barkProbability: 0.5, barkMs: 2500,
})
```

- [x] **2.4 追加用例**：Kai making_coffee/checking_shelf/未到柜台均不能反应；Mira 未到冷柜不能响应 hum；长路线不入候选；Cat 睡眠/人语排除；锁住角色排除；所有返回活动通过 `requireNpcActivity`；台词不立即重复。运行 `node --test tests/world-reactions.test.js tests/ambient-director.test.js`。

## Task 3：世界控制器、互斥与寿命

**Files:** 新增 `src/game/worldEvents.js`、`tests/world-events.test.js`。

**Consumes:** Task 2 配置/选择接口；Director `reserve('world-event')` / `release('world-event')`；本计划开头的回调与 clock 接口。

**Produces:** `createWorldEvents`，不依赖 React/DOM/audio。

- [x] **3.1 写可注入假时钟。** 放在 `world-events.test.js`，不改变现有测试的全局时钟：

```js
function clock() {
  let time = 0, serial = 0
  const jobs = new Map()
  return {
    now: () => time,
    setTimer: (fn, ms) => { jobs.set(++serial, { fn, at: time + ms }); return serial },
    clearTimer: id => jobs.delete(id),
    jobs,
    tick(ms) {
      const target = time + ms
      while (true) {
        const next = [...jobs].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        jobs.delete(next[0]); time = next[1].at; next[1].fn()
      }
      time = target
    },
  }
}
```

- [x] **3.2 写并运行控制器失败用例。** 使用记录 assign/onEvent/onSpeech 的数组和 `createInitialNpcActivities`；先用 reserve 返回 false 隔离环境行为：start 两次仅一个机会 timer；45 秒前无事件；trigger 后 getRecentWorldEvent 正确；29,999 ms 尚有效、30,000 ms 失效；新事件替换后调用捕获的旧过期回调不清新事件；stop/start 后旧机会无效。运行 `node --test tests/world-events.test.js`。
- [x] **3.3 实现环境部分。** 每个 timer 持有 token；getRecentWorldEvent 直接核对 `now() < expiresAt`，不只依赖 React/timeout 刷新。每次机会/手动 trigger 从现在安排下一次；避免后台恢复后追赶 missed opportunities。

```js
function getRecentWorldEvent() {
  return recent && now() < recent.expiresAt ? recent.id : undefined
}
// 替换事件时保存对象身份，回调必须检查：
const ownEvent = recent
expiryTimer = setTimer(() => {
  if (!running || recent !== ownEvent) return
  recent = null
  onEvent(null)
}, WORLD_EVENTS.lifetimeMs)
```

- [x] **3.4 加入反应/气泡 tests 后实现反应生命周期。** 先生成候选，空候选或抽签失败不 reserve。reserve 成功后保存 `{ npcId, activity, destination, token }` 再 assign，防同步 report；当前目标已经到达则直接 settle。到达时核对 phase、destination 以及 `getActivities()[npcId]`，拒绝旧位置报告。只在人类反应 settle 时以 `< 0.5` 抽气泡，2.5 秒后清理自身并释放 owner；没气泡立即释放。

```js
if (random() >= WORLD_EVENTS.reactionProbability || !candidates.length) return
if (!director.reserve('world-event')) return
// 选中一个候选后创建 pending，再派发 activity；不能先 assign 后存 pending。
// 清理过程中只释放自己的 owner。
director.release('world-event')
```

- [x] **3.5 覆盖实际 Director 互斥。** 另建集成 fixture 使用真实 `createAmbientDirector`、fake clock 和三人 idle reports。断言：counter-social 已 reserve 时事件仍发出但无 assign；普通 movement/pending 时不反应；世界 reserve 期间普通活动不开始；到达/气泡结束后恢复；玩家锁反应者后气泡取消，旧回调不会清新 speech；外部活动替换后清 world pending，不能回写旧活动。模拟反应派发后旧 counter/notes_spot idle 报告，不能提前完成。
- [x] **3.6 运行** `node --test tests/world-events.test.js tests/world-reactions.test.js tests/ambient-director.test.js tests/counter-coherence.test.js tests/finite-activities.test.js`。

## Task 4：Web Audio 音景与资源释放

**Files:** 新增 `src/audio/soundscape.js`、`src/hooks/useSoundscape.js`、`tests/soundscape.test.js`。

**Consumes:** 事件 ID；audio 工厂/状态接口。无 React movement 依赖。

**Produces:** `createSoundscape`；`useSoundscape(eventId)` 返回 `{ status, muted, toggleMuted }`。

- [x] **4.1 编写 fake AudioContext 的最小记录器并写失败测试。** Gain/Filter/Source mock 只记录 connect/disconnect、参数 automation、start/stop，不模拟浏览器声音。工厂调用计数初始为 0；applyEvent 和 setMuted 在 unlock 前不创建 context；resume reject 不产生未处理 rejection；dispose 后迟到 resume 不再连接/升增益。

```js
test('locked soundscape never creates an audio context or replays door noise', async () => {
  let contexts = 0
  const states = []
  const sound = createSoundscape({
    createContext: () => { contexts++; throw new Error('unsupported') },
    onState: state => states.push(state),
  })
  sound.applyEvent('door_noise')
  sound.setMuted(true)
  assert.equal(contexts, 0)
  await sound.unlock()
  assert.equal(states.at(-1).status, 'unavailable')
  sound.dispose()
})
```

- [x] **4.2 运行** `node --test tests/soundscape.test.js`。修正后使用本地 CC0 雨声录音；rainGain 的柔和/基础/增强目标为 0.22/0.4/0.7，masterGain 0.65，初始 master 为 0。许可与循环处理见 public/assets/audio/README.md。

```js
function ramp(parameter, target, seconds, context) {
  const time = context.currentTime
  parameter.cancelScheduledValues(time)
  parameter.setValueAtTime(parameter.value, time)
  parameter.linearRampToValueAtTime(target, time + seconds)
}
```

优先 cancelAndHoldAtTime 保持连续；雨声 3 秒渐变，master 2 秒入场/0.2 秒静音。目标绝对赋值、不累乘；quiet_lull/事件清空回基线。door_noise 只在运行且未静音时产生单次门声。

- [x] **4.3 覆盖异步状态竞态。** unlock 重复调用复用 pending Promise；dispose 增加 generation token 并 stop/disconnect/close；resume resolve 后检查 token/muted。静音期间门响直接丢弃，解锁不重放；无 AudioContext 工厂返回时保持 unavailable，允许界面正常运行。`onState` 不在已卸载实例上发布状态。
- [x] **4.4 实现 hook 的可信手势接线。** 挂载只添加监听器，交互成功解锁或确认 unavailable 后移除；cleanup 移除并 dispose，Strict Mode effect 再次 setup 创建新控制器。首次点击静音控件不得先触发短暂播放：先由 capture 手势识别该按钮并设置 muted，再 unlock。

```js
function onGesture(event) {
  if (!event.isTrusted) return
  if (event.type === 'keydown' && (event.repeat || event.key === 'Shift' || event.key === 'Control')) return
  if (event.target instanceof Element && event.target.closest('[data-sound-toggle]')) {
    controller.setMuted(true)
  }
  void controller.unlock()
}
```

最终按钮 handler 与 capture 路径共享一次用户操作意图，不能 capture mute 后冒泡立即反向 unmute。用当前偏好 ref 决定 toggle；初始偏好未静音，第一次按钮操作为静音。
- [x] **4.5 运行** `node --test tests/soundscape.test.js`；覆盖每个事件 gain 目标、mute 前后值、录音加载失败、一次性源清理、unsupported/resume rejection、Strict Mode 和迟到 resume。

## Task 5：React 接线、speech 所有权与请求有效期

**Files:** 修改 `src/hooks/useNpcActivities.js`、`src/App.jsx`、`src/components/DialoguePanel.jsx`、`src/lib/chat.js`、`src/styles.css`；新增 `tests/world-events.browser.jsx` 并接入 `tests/runtime.browser.jsx`。

**Consumes:** Task 1–4 接口；现有 App/DialoguePanel/activity props。

**Produces:** App 集成音景和世界事件，返回 `getRecentWorldEvent` 供每次 submit 读取，不存第二份 NPC 活动。

- [x] **5.1 在浏览器 fixture 中写失败断言。** 新导出 `verifyWorldEvents(root, container, check, intervalClock)`，沿用 `act` 和真实 App。测试监听 dev diagnostics，触发事件后只显示一个合适气泡；存在玩家锁时该 NPC 不变化；社会 speech 已存在时 world cleanup 不清掉它。捕获 `/api/chat` 的 request body，确认 semantic ID，过期后再次提交不带该字段。
- [x] **5.2 拆分 speech state，接入控制器。** `coherence` 的 onSpeech 只写 socialSpeech；world 只写 worldSpeech。用现有 activity latest ref；movementObservers 在更新 director/finite/coherence 后调用 world.report。layout effect 将同一玩家锁传给三个协调器。

```js
const [socialSpeech, setSocialSpeech] = useState(null)
const [worldSpeech, setWorldSpeech] = useState(null)
const speech = socialSpeech || worldSpeech
```

world start 在 director 和 coherence start 后；cleanup 先 stop world/coherence/finite，再 stop director。不要把 state 依赖加入控制器创建依赖导致每次 render 重新启动计时器。
- [x] **5.3 将事件送给音频和玩家请求。** App 用当前有效事件 state 驱动 `useSoundscape`；DialoguePanel 接收 `getRecentWorldEvent` 回调并在 submit 内求值，不将捕获的过期值留给重试。

```js
const recentWorldEvent = getRecentWorldEvent?.()
const reply = await sendChat({
  npc: character.id, message: text, history, activity,
  recentWorldEvent, signal: controller.signal,
})
// sendChat 签名增加 recentWorldEvent，JSON.stringify 显式投影：
body: JSON.stringify({ npc, message, history, activity, recentWorldEvent })
```

- [x] **5.4 添加 HUD 音频控件。** 使用小字体、透明底、现有暖色文本和可见 focus outline；按钮有 `data-sound-toggle`、`aria-pressed={muted}`、中文 accessible label。SOUND ON/OFF 文字仅描述用户偏好；unavailable 加 `title` 说明，不弹 modal。

```jsx
<button type="button" className="sound-toggle" data-sound-toggle
  aria-label={muted ? '开启环境音' : '关闭环境音'}
  aria-pressed={muted} onClick={toggleMuted}>
  {muted ? 'SOUND OFF' : 'SOUND ON'}
</button>
```

- [x] **5.5 运行 targeted Node + browser fixture。** 失败后只修接线，不调整路线/导演节奏；保留已经在途的请求不受事件过期干扰。测试先失败后重试恰在 TTL 后，不发送旧事件；新事件到来时只替换 world context，不改玩家输入/history。

## Task 6：开发入口、真实音频解锁与生产回归

**Files:** 新增 `tests/world-preview.html`、`tests/world-preview.jsx`；修改 `tests/world-events.browser.jsx`、`tests/runtime.browser.jsx`，必要时 `tests/production.browser.js`；App/hook 增加 DEV-only listener。

**Consumes:** 原有 App，世界控制器 trigger 和诊断回调。

**Produces:** `/tests/world-preview.html` 可立即测试四事件，普通生产无调试 API。

- [x] **6.1 编写 dev harness。** 沿用 counter-preview 的独立 HTML/Vite entry 模式，挂载真实 App + 开发工具条。HTML title 为 World events preview。所有控制按钮统一向 `world-event-trigger` 发送 ID；hook listener 必须由 `import.meta.env.DEV` 包裹，仍经过白名单/锁校验。

```js
window.dispatchEvent(new CustomEvent('world-event-trigger', { detail: { id: 'rain_intensifies' } }))
// DEV-only 回调，两个来源分别发布纯展示信息：
window.dispatchEvent(new CustomEvent('world-event-debug', { detail }))
window.dispatchEvent(new CustomEvent('world-audio-debug', { detail: audioState }))
```

面板四按钮由白名单生成，显示 EVENT、RESPONDER、BARK、AUDIO STATE 和跳过原因；不强制指定角色/越过锁，不伪造 trusted 输入。
- [x] **6.2 加入 deterministic 浏览器覆盖。** 独立子测试为 world 计时器安装/恢复 local fake clock，避免覆盖既有 social 90,000ms 用例；自动 world 不能在长回归中随机打断断言。分离 fixture 中的随机序列，确保现有 Director 首次随机值仍为 0。所有 global overrides 在 finally 恢复。
- [x] **6.3 启动/复用开发服务。** 先确认端口是否已有本项目 Vite，再使用 `npm run dev -- --host 127.0.0.1 --port 5176 --strictPort`。普通 Vite 不验证真实 Vercel API；当前测试使用明确 mock，不能宣称真实 LLM E2E。
- [x] **6.4 通过 browser skill 操作验证。** 开新 tab 进入 world-preview，未交互时 AUDIO STATE 应为 locked；真实点击页面后 running，点按钮变 muted，再点恢复。synthetic `.click()` 不得作为音频解锁验收依据。逐个事件观察状态、台词、角色数、窗口/冷柜条件；测试连续快速触发无重叠气泡，quiet_lull 清 transient。
- [x] **6.5 验证 runtime 和生产。** `/tests/runtime.browser.html` 的 `#results.dataset.result` 必须 passed，保存实际 check count 和 console。运行 build 后使用既有 `node tests/cold-assets-server.mjs`，打开 `/__demo__/production.browser.html`。生产发送 world-event-trigger 自定义事件不得触发调试行为。检查冷缓存人物、画像、遮挡、responsive/输入、静音按钮无布局挤压；真实音频人工听感需单独报告。

## Task 7：完整验证、文档与停止

**Files:** 修改 `README.md`；仅按实现更新设计/计划状态。

**Consumes:** 全部已实现行为和测试实测结果。

**Produces:** 可验收 Stage 5 working tree，无 Git 提交。

- [x] **7.1 更新 README。** 保留历史阶段，新增 Stage 5 说明：四事件、45–90秒/30秒/2.5秒、可信交互解锁、静音、开发入口、API optional field、前端会话 TTL 边界、录音听感需人工验收；不写真实 env key。
- [x] **7.2 执行完整 Node 回归。**

```sh
node --test tests/*.test.js
```

要求所有已存在及新增测试通过；记录实际数量，不引用旧任务的 238/958 等历史数字当本轮结果。
- [x] **7.3 执行生产构建和 diff 检查。**

```sh
npm run build
git diff --check
git status --short
```

对于未跟踪新文件额外检查尾部空格/冲突标记，因为 git diff 默认不包含它们。核对没有修改 PNG、routes、movement、occlusion 文件或 Git tag。
- [x] **7.4 汇总 browser/runtime、生产 smoke 与 console。** 如果 7.2/7.3 修了产品代码，按相关范围重跑受影响 browser 测试；不在没有变化时反复跑全套。分别报告 mock API 与真实用户手势音频测试，未进行真实 LLM 调用就明确说明。
- [x] **7.5 最终报告并停止。** 文件清单、音频/世界架构、反应/bark/context、互斥、tests/build、音质/浏览器差异限制、Git 状态；确认没有 commit/tag/push，不自动扩展 Stage 5。

## 自检与执行建议

覆盖映射：设计音景→Task 4/5/6；事件/寿命→Task 2/3；NPC与气泡→Task 2/3/5；API→Task 1/5；验证→Task 6/7。五个 Review Focus 均有指定测试步骤。

建议 **Native**：七项任务连续依赖同一控制器/React 接口，当前执行者顺序完成能减少交接成本。使用 executing-plans 技能落实每个任务，最终独立 reviewer 按所选执行流程检查。备选 Subagent-driven 按任务分配实现和审查，开销更高。用户已批准并选择 Native；实施完成，保持未提交工作树。
