# Stage 5 — Living World 实施报告

Stage 5 已完成。所有改动保留在 `feat/stage-5-living-world` working tree；没有 commit、tag、push、部署或新增依赖。

## 已实现

- 原生 Web Audio 播放本地 CC0 雨声循环与一次性短门响；无室内底噪。真实操作后加载、解锁、渐入、静音与恢复；挂起后恢复同一 context。
- 四类世界事件：雨变大、雨变小、门响、安静间隙。首次/后续机会均为随机 45–90 秒，避免连续相同事件；最新语义上下文保留 30 秒。
- 在安全候选中以 50% 概率选择一个反应者，忙碌时仅发生环境事件。人类反应到达后再以 50% 概率说一句变体短句，2.5 秒消失。Cat 不说人话，睡眠不被世界事件唤醒。
- Kai 仅在柜台普通姿态下原地回应；Mira 使用原窗边活动；Cat 使用原看门活动。路线超过既有中距离阈值时不作为世界反应候选。
- 世界反应复用 Director reservation，保留玩家与进行中社交的优先权；没有修改 Director cadence、route graph、movement、finite task、回柜台或社交生成算法。
- `/api/chat` 新增可选语义 `recentWorldEvent`；白名单校验、服务端受控 context、缺失字段兼容，history 和当前消息顺序不变。每次发送/重试检查有效期，过期不再发送。模型、参数、fallback/timeout 链路不变。
- 开发页提供四个立即触发按钮和 EVENT / RESPONDER / BARK / AUDIO STATE；仍遵守概率和锁。生产没有开发触发 listener。

## 文件

新增生产文件：

- `shared/worldEvents.js`
- `server/world-event-context.js`
- `src/data/worldEventReactions.js`
- `src/game/worldEvents.js`
- `src/audio/soundscape.js`
- `src/hooks/useSoundscape.js`

修改生产文件：

- `server/chat-handler.js`、`server/openrouter.js`：只增加可选事件校验和 messages context。
- `src/hooks/useNpcActivities.js`：连接控制器、移动回报、锁及独立 speech 所有权。
- `src/App.jsx`、`src/components/DialoguePanel.jsx`、`src/lib/chat.js`：音景/HUD 控件及语义事件请求。
- `src/styles.css`：小型静音控件样式与 pointer-events。

新增测试/开发入口：`tests/world-reactions.test.js`、`tests/world-events.test.js`、`tests/soundscape.test.js`、`tests/world-events.browser.jsx`、`tests/world-runtime.html`、`tests/world-runtime.jsx`、`tests/world-preview.html`、`tests/world-preview.jsx`。

修改测试：`tests/chat.test.js`、`tests/openrouter.test.js`、`tests/runtime.browser.jsx`、`tests/production.browser.js`。

文档：`README.md`、设计文档、实施计划及本报告。

## 自动验证

| 验证 | 最终结果 |
| --- | --- |
| `node --test tests/*.test.js` | 261 / 261 通过 |
| 完整 `tests/runtime.browser.html` | 977 项通过，包含世界事件的 19 项 |
| 独立 `tests/world-runtime.html` | 19 项通过 |
| 生产 `production.browser.html` | 41 项通过 |
| 冷缓存 sprite 采样 | 160 次，无消失或重复可见精灵 |
| 响应式生产检查 | 1280×720、1440×900、1024×768、390×844 通过 |
| `npm run build` | 通过，无构建 warning |
| `git diff --check` | 通过 |
| 新文件冲突标记/代码尾空格检查 | 通过 |
| `.env.local` | 仍被 Git ignore；未读取或输出真实 key |

回归覆盖 Kai/Mira/Cat 移动、帧/足点/热点、counter/shelf occlusion、活动视觉、有限任务/回柜台、社交生成与 fallback、玩家输入/错误重试/history/画像，以及世界机会、TTL、互斥、气泡清理、API 验证和音频状态。

浏览器真实按钮操作已验证：首次直接点静音保持静音；重新开启进入 running；四种事件可触发；synthetic click 不解锁声音。音频挂起恢复另由可控 AudioContext 边界测试验证，不声称完成所有浏览器/操作系统真实挂起场景。

完整 runtime、开发验收页和独立生产主页 Console 没有 error/warning。生产 iframe 自动化测试日志曾出现一条 `MutationObserver.observe` 非 Node 参数错误；测试内应用脚本错误及未处理 rejection 采集为零，独立生产主页面未复现。保留这条工具/iframe 环境差异记录，不将整个工具日志描述为完全无错。

Node/provider 与浏览器 API 回归使用 mock；生产回归通过真实本地 HTTP 调用真实 handler、注入测试回复。本轮没有发送真实 OpenRouter 请求，不将 mock 通过等同于在线模型质量验收。

## 审查与修复

独立 read-only reviewer 完成检查。已用失败测试复现并修复：

1. 新移动尚未回报时快速连续触发事件，过早释放 reservation 可派发第二人。现在保留派发锁直到真实 movement report 接管。
2. 已有音频 graph 的 context 被挂起后无法恢复。现在复用 context/graph 并执行 resume。
3. 已到达且正在发言时被外部活动替换，旧气泡未立即清理。现在先校验活动所有权。
4. 手动连续触发相同事件 ID，React effect 不再收到新事件。音频 hook 同时观察本地 sequence；sequence 不发送到 API。

没有延期的 reviewer minor 项。真实耳机/扬声器音质、操作系统音频挂起差异及真实模型语气仍属人工验收边界。

## 执行中的小范围决定

- 直接在用户指定 checkout 工作，保持不提交；保留被忽略的执行日志用于未提交工作的追踪。代价是版本仍需用户验收后自行提交。
- 加入独立 world-runtime 测试页，便于快速复现；与完整 runtime 共用同一测试模块，无生产调试入口。
- 将两项被 reviewer 标为 Minor 的清理/重复音效问题按验收缺陷处理，一并补测修复；代价仅为少量测试和新模块内修改。
- 私有音频 hook 增加事件 sequence 参数，用于相同 ID 的重复通知；不扩展服务器契约。

## 人工验收

开发服务运行时：

- 主场景：<http://127.0.0.1:5176/>
- 立即触发世界事件：<http://127.0.0.1:5176/tests/world-preview.html>

建议：先用耳机和扬声器确认基础音量及门声是否克制；再观察主场景数分钟，判断 45–90 秒机会、可选反应与短句是否自然。开发页没有反应时先看 REASON，不需要强行让每次事件都演出。检查窄屏声音按钮、人物对话和画像的视觉平衡。

5176 是 Vite 前端端口；真实玩家/社交对话需要项目既有 Vercel 本地后端。当前没有运行 3000 后端；本轮没有登录、部署或修改远程配置。恢复后端后可在同一后端 origin 的开发页触发事件，再问角色相关问题，人工验收事件提及是否自然而非每句播报。

语义 TTL 由前端会话管理；服务端只验证 ID，不独立证明事件时间。气泡是有限本地变体池，长期观察仍可能重复。雨声已替换为录音；音色、循环感和音量仍须人工试听。

完成 Stage 5 后停止，未开始下一阶段。

音景人工验收后的修正结果见 [Soundscape Correction](stage-5-soundscape-correction.md)。下方/上文既有测试计数保留为初次实现记录；最新计数以修正报告为准。
