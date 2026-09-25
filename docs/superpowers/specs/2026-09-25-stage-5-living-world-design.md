# Stage 5 — Living World 设计

日期：2026-09-25  
状态：设计与计划均已批准；Native 实施及自动验证完成，待人工音质/节奏验收。

## 1. 目的与边界

在已经稳定的便利店场景中增加低频环境变化，让 NPC 偶尔注意到世界，而不是让世界不断表演。保留 Stage 4 的活动调度、有限任务、Kai 自动回柜台、社交生成与 fallback、移动、画面、遮挡、人物对话和画像。

本阶段仅新增：音景、四类语义世界事件、可选单人反应、短气泡、近期事件对话上下文、开发验证入口。

不新增关系数值、长期记忆、数据库、任务、物品、新角色、地图、艺术资产或大型调度系统。不改变 OpenRouter 模型、重试/fallback 行为或社交生成链路。不 commit、tag、push。

## 2. 已确认的技术方向

音景修正后仍采用原生 Web Audio 控制器，主雨声改为本地 CC0 录音循环，移除持续室内底噪，保留短合成门响。素材来源和参数见 public/assets/audio/README.md。

世界事件控制器与 Ambient Activity Director 分离，复用后者的 `reserve` / `release`、现有 movement reports 和 interaction locks。音频与环境语义不依赖 NPC 能否反应。

代码检查确认：

- `useNpcActivities` 已集中接入 Director、finite activities、counter coherence 和移动观察回调。
- Director 已有单 reservation 和移动期间互斥机制。
- `counterCoherence` 在社交接近、生成、发言和离开期间占用 reservation。
- `AmbientSpeechBubble` 可以复用；社交与环境气泡需要分别持有状态，避免清理回调相互覆盖。
- `/api/chat` 已校验可选 activity，适合以同样边界添加可选世界事件 ID。

## 3. 世界事件与生命周期

集中配置四个 ID：`rain_intensifies`、`rain_softens`、`door_noise`、`quiet_lull`。共享模块仅放可接受的语义 ID 和校验；自然语言 prompt 仍放服务端。

| 参数 | 设计值 |
| --- | --- |
| 首次及后续事件机会 | 每次随机 45,000–90,000 ms |
| 事件选择 | 四类均有机会；存在其他选择时避免连续相同 ID |
| 最新事件对话有效期 | 30,000 ms |
| 合适 NPC 的反应概率 | 50%；没有候选则无反应 |
| 已选人类角色的气泡概率 | 50% |
| 气泡持续时间 | 2,500 ms |

机会出现时更新环境语义并通知音频；再尝试选择安全的 NPC 反应。忙碌机会直接跳过 NPC 反应，不排队、不追赶执行。`quiet_lull` 不选择 NPC、不发言、不制造音效；保留基础雨声。

每次只保留一个最新事件，替换旧事件及其过期计时器。30 秒到期后清空对话上下文；过期本身不改变 NPC 活动，不触发新的世界事件。

计时器使用实例 token 防止过期回调清除更新状态；stop/unmount 清理调度、过期和气泡回调。开发触发复用同一事件入口，重新计算后续机会，避免手动触发后自动事件紧接着叠加。

## 4. 音景

小型音频控制器只保留录音雨声层和 master gain；可信手势后 fetch/decode，AudioBufferSource 循环播放。门响为不叠加的一次性短音，播放后释放；失败安全降级。

首次可信 pointer 或 keyboard 操作才创建/恢复 AudioContext；不在挂载时播放。基础音量约 2 秒渐入，静音切换约 0.2 秒淡出/淡入。HUD 添加一个小型 SOUND ON/OFF 控件，含可访问名称和键盘操作；不改其余布局。

环境音量为绝对目标：柔和 0.22、基础 0.4、增强 0.7，master 0.65，约 3 秒渐变；事件过期或 quiet_lull 回到基础雨声，不累加增益。

锁定、运行、静音、不可用状态明确区分。静音期间不积压门响等音效；解锁只应用当前有效环境状态，不重放过去事件。AudioContext 不支持或恢复失败时，页面继续静音运行，不产生未处理异常或阻塞交互。卸载释放节点和 context；不持久化偏好。

## 5. NPC 反应规则

反应只使用现有活动 ID、位置映射和路线。先筛选候选，再决定是否反应；一次最多一人。

| 事件 | 安全候选与反应 |
| --- | --- |
| rain_intensifies | Kai 已在柜台则可原地短句；Mira 可使用 `staring_out_window`；Cat 可使用 `watching_door` |
| rain_softens | Kai 已在柜台可原地短句；Mira 已在窗边可原地短句；不为此额外远行 |
| door_noise | Kai 已在柜台可原地短句；Cat 可使用 `watching_door` |
| quiet_lull | 无 NPC 反应、无气泡 |

Kai 必须是 `behind_counter` 且到达 counter，世界事件不能覆盖其咖啡/检查货架任务，也不能取消待执行的回柜台动作。Kai 世界事件永远不分配离开柜台的活动。

Mira/Cat 的移动候选使用现有 route distance 和 Director 的短/中距离标准，拒绝长距离反应。Cat 睡眠时不主动唤醒；其他自然活动可按规则转为看门。Cat 永远没有人类台词。

同位置/同活动反应无需重新 assign 或伪造行走。需要移动时 walking visual 保持到实际 arrival，随后由现有系统展示目标活动；气泡在到达后显示，不提前声称完成动作。反应不强迫返回原地点；后续普通活动仍由原 Director 管理。

## 6. 协调与气泡所有权

优先关系：玩家交互 > 已进行的社交事件 > 世界反应 > 尚未开始的普通 ambient 事件。

- 对正在交互的角色，不选择、不重分配、不显示环境气泡。
- 进行中的社交事件不被世界事件中断；其 reservation 会使世界反应申请失败。
- 任何正在移动的角色或已有 Director pending event，都使新世界移动申请失败。
- 世界反应取得 reservation 后，普通调度暂缓；到达并结束可选气泡后释放。原地无气泡反应立即释放。
- 已经开始的短世界反应不会为了新的社交机会被强行中断；不新增社交队列或改社交机会计时。
- 玩家与反应者交互时立刻取消气泡/后续反应逻辑并释放世界 reservation，不回滚活动，不中断或改造既有移动。Director 仍根据 movement reports 阻止并发移动。
- 新世界事件、活动被外部替换或 unmount，使旧反应 token 失效并清理其持有状态。不会释放其他 owner 的 reservation。

社交气泡与世界气泡分别维护，渲染时社交优先；不能用共享的无来源 `setSpeech(null)` 清除另一系统的新气泡。开发手动触发同样经过安全锁。

环境台词使用集中管理的小型变体池，无新 LLM 请求。Kai 简短克制，Mira 疲惫而稍有表达；避免同一事件/角色连续复用同一句，只保留选择索引，不记录永久历史。本轮每次一个短句，不需要两句播放系统。

## 7. Event-aware 玩家对话

数据路径：世界控制器最新有效事件 → App → DialoguePanel 当前请求快照 → `sendChat` → `/api/chat` → 服务端受控 context → 原 OpenRouter messages。

只增加可选 `recentWorldEvent` 字符串，前端不发送年龄、坐标、路线、帧、任意环境描述或 prompt。缺失字段保持兼容；非字符串/未知 ID 返回统一 400 错误。服务端将白名单 ID 转换为短环境描述，并要求角色仅在相关时自然回应，不断言角色执行过某个动作。

messages 保持角色设定、场景、活动、可选事件 context、history、当前 user message 的顺序；当前消息不重复，history 不串 NPC。整个原有 provider fallback 路径使用相同上下文，不更改模型或参数。

前端在发送时核对事件有效期，过期不发送；已经发出的请求使用发送时快照，返回前事件过期不取消该请求。手动重试保留玩家原消息/history，但重新取当前有效的事件上下文，避免复用已失效的环境提示。

30 秒有效期由当前浏览器会话管理。无服务端会话/数据库，服务端只能确认 ID 合法，不能独立证明客户端事件发生时间；这是明确的本阶段边界。

## 8. 文件职责与最小改动范围

预计新增：

- `shared/worldEvents.js`：事件 ID、校验。
- `src/game/worldEvents.js`：纯控制器、时序、反应生命周期；支持注入 clock/random。
- `src/data/worldEventReactions.js`：反应候选、台词变体、概率配置。
- `src/audio/soundscape.js`：Web Audio 控制器。
- `src/hooks/useSoundscape.js`：可信交互监听、React 生命周期与音频状态。
- `server/world-event-context.js`：服务端受控上下文。
- 对应 Node 测试，以及 `tests/world-preview.html` / `.jsx` 和浏览器回归。

增量修改 `useNpcActivities` 接线与气泡所有权、App 音频/HUD/事件 props、DialoguePanel 请求快照、sendChat、chat handler、OpenRouter 的 messages 构造，以及必要 CSS、README 和测试入口。

尽量不修改 Director / counterCoherence 公共契约；若验证表明必须补充只读忙碌信息，范围限定为协调状态，不改变原时间常量或路线。sprite、图片、移动/遮挡算法不在改动范围。

## 9. 开发入口与验收

开发页挂载同一 App，通过 DEV-only 入口触发全部四种事件，显示 EVENT、RESPONDER、BARK、AUDIO STATE 与跳过原因。正常生产页面只显示静音控件，不暴露调试按钮；测试页生产环境不可启用触发能力。

Node 测试覆盖：45–90 秒边界、重复选择、30 秒过期与旧 token、quiet_lull、无候选、最多一个反应、Kai 柜台约束、Cat 无人语、短/中路线筛选、50% 概率边界、2.5 秒气泡清理、reservation/玩家/社交冲突、事件校验与 messages、音频解锁/静音/释放。

浏览器测试覆盖真实用户操作解锁、静音切换、事件按钮、音频状态与节点参数、移动到达后发言、玩家中断、气泡不互相清除、对话请求事件字段及过期、冷缓存 sprite 连续可见。录音听感仍需人工听感验收；自动测试不宣称验证主观音质。

完整运行现有 Node、浏览器/runtime 回归和生产构建；检查 console error/warning、`git diff --check`。重点保留 Kai/Mira/Cat 移动、遮挡、有限任务/回柜台、社交 LLM/fallback、画像、输入/loading/error/retry 和 sprite preload。

最终报告逐项区分自动验证与人工听感限制，报告实际文件、测试结果和 Git 状态。完成 Stage 5 后停止，不自动进入新阶段。
