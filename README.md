# 2:17 AM

Somewhere, someone is still awake.

雨夜便利店里的单页面互动叙事原型。React + Vite + JavaScript + CSS；当前采用一张完整像素风场景资产与透明交互热区。

## 本地运行

使用兼容 Vite 7 的 Node.js（20.19+ 或 22.12+，建议当前 LTS）。

```sh
npm install
npm run dev
```

打开终端显示的地址，默认 http://localhost:5173。

```sh
npm run build
npm run preview
```

构建结果位于 `dist/`。`npm run dev` / `npm run preview` 只提供前端，不运行 `/api/chat`；此时发送输入会显示请求失败提示。场景和原有固定选项仍可使用。

## 操作

- 点击画面中的 Kai / Mira 打开对话；点击另一角色直接切换。
- 输入文字后按 Enter 或点击“说完了”发送。中文输入法确认文字的 Enter 不会发送；空白输入不能发送。
- 请求中显示省略号并禁止重复发送；失败保留草稿供重试。关闭或切换角色会取消未完成请求。
- 两个回应选项保留原有固定文本。
- 点击 × 或按 Escape 关闭对话，键盘焦点返回对应角色。
- 点击猫显示独立提示，5 秒后消失；重复点击重新计时，不影响人物对话。
- 鼠标悬停、键盘聚焦及选中时显示像素姓名提示和小标记。
- 热区使用原生 button，支持 Tab 与 Enter / Space。雨层遵守系统减少动态效果设置。

## 场景与交互分离

```text
App                              NPC 选择、分角色会话 history、HUD、猫反馈
  ConvenienceStoreScene          场景尺寸与叠层容器
    SceneBackground              单张场景图，包含建筑、商品、光影和角色
    RainOverlay                  只在配置的玻璃/街道区域显示 CSS 雨线
    NPC × 3                      透明 button 热区，不绘制角色
  DialoguePanel                  固定选项、玩家输入、请求状态、最新回复
```

- `src/data/scene.js`：资产路径、原始尺寸、热区百分比矩形和雨层区域。
- `shared/npcs.js`：统一的公开角色配置、原有固定对话和输入限制；`src/data/characters.js` 保留为兼容导出。
- `src/lib/chat.js`：原生 fetch 调用 `/api/chat`，不包含服务端配置或凭据。
- `src/styles.css`：视口取景、HUD、热区提示、雨线、对话框与基础响应式布局。

主图与热区共享同一个保持原图宽高比的容器。桌面使用覆盖视口的取景；裁切只影响可见范围，不改变热区相对图像的位置。手机保留整张图的基础展示。打开对话不改变场景大小。

## 当前视觉资产

`public/assets/scenes/after-hours.png`：1536 × 1024，约 2.9 MB。

使用内置 image_gen 工具生成；用户提供的图片仅作为画风、光影及构图参考。没有将参考截图直接作为游戏背景，也未下载第三方游戏素材。完整提示词和来源记录保存在 `public/assets/scenes/ART-DIRECTION.md`。

Kai、Mira、猫已经绘入主图，因此不再叠加旧精灵、柜台前景、CSS 标牌或程序化货架。`public/art/` 和原来的 Python 素材脚本仍保留作历史参考，不参与当前场景渲染。运行项目无需 Python，也无需任何图像生成凭据。

### 替换素材

1. 将新图放进 `public/assets/scenes/`。
2. 在 `src/data/scene.js` 更新 `src`、`width`、`height`。
3. 按实际新图量取各角色矩形，换算为百分比：`x / 图片宽度 × 100`、`y / 图片高度 × 100`，宽高同理。
4. 更新雨层区域，验证桌面与窄屏热区对齐。对话数据与状态逻辑无需更改。

## Stage 2.2B：Character Prompt / NPC Personality

```text
DialoguePanel → fetch POST /api/chat → api/chat.js
                                      ↓
                              server/chat-handler.js（校验）
                                      ↓
                              server/openrouter.js（真实模型回复）
```

`api/chat.js` 是 Vercel Node.js Function，采用 Web Request / Response 接口。请求示例：

```json
{"npc":"mira","message":"你为什么这么晚还在这里？","history":[],"activity":"reading_notes"}
```

成功返回 `{ "reply": "..." }`；失败统一返回 `{ "error": "..." }`。非 POST 返回 405；无效 JSON、未知角色、空白或超长 message、错误 history 返回 400；服务端异常返回 500。Cat 不进入这个 API。

history 只保存在 `App` 的 React state 中，按 Kai / Mira 分开保存最近 20 条消息（10 轮），刷新即消失。每次请求发送之前成功的完整 user / assistant 对话对，当前 message 单独传递；失败或取消的请求不写入 history。原 Stage 1 固定选项仍为本地反馈，不进入 API history。关闭面板会丢弃未发送草稿，保留已完成会话。

Stage 2.2B 的服务器端使用原生 fetch 调用 `https://openrouter.ai/api/v1/chat/completions`，当时模型固定为 `openrouter/free`。Stage 2.2C 的环境变量配置见后文独立章节。

messages 按「服务端 system message → 当前 NPC 的合法 history → 当前 user message」构造，当前输入只追加一次。只读取 `choices[0].message.content`，并转换为 `{ reply }`；不转发原始 JSON、reasoning 或上游错误详情。请求明确关闭 streaming，设置 `reasoning: { enabled: false }`，并保留 512 token 的生成上限。此上限为短对话留出余量，句数主要由已有角色 prompt 约束，不截断字符串。服务端超时 45 秒，前端等待上限 60 秒。缺少 API Key 返回 503，网络/上游/回复格式错误返回 502，超时返回 504；错误结构仍为 `{ error }`。

角色约束集中在 `server/characters.js`：共用凌晨 2:17 雨夜便利店世界设定，再按 npc id 组合 Kai / Mira 的身份与口语风格。Kai 为安静、干冷幽默的年轻夜班店员，通常 1～3 句；Mira 为疲惫、自嘲、稍健谈的研究生，通常 2～4 句。句数通过 prompt 约束，保留 512 token 上限，不剪切回复字符串。共享的 id/name/role 仍在 `shared/npcs.js`；完整 prompt 不进入前端，客户端自带 systemPrompt 字段不参与请求构造，history 中的 system 角色会被拒绝。

只返回 content，请求设置 `reasoning: { enabled: false }`。实测有路由模型把分析或分类文本写进 content，因此增加了针对明确 think/analysis 标记和安全分类前缀的最小校验；命中时沿用无效回复 502 与现有重试 UI，不把该轮写入 history。这不是全面的输出语义检测，无法保证模型每次遵守角色。没有数据库、关系系统或长期 Memory。参考 [OpenRouter API 文档](https://openrouter.ai/docs/quickstart) 与 [reasoning 输出控制](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)。

### 完整本地联调

需要 Vercel CLI；本轮使用已有缓存 CLI 尝试启动，但没有可用登录凭据，未执行登录、关联项目或部署。可以由开发者在项目目录运行：

```sh
npm install
npx vercel dev --listen 3000
```

`npx` 可能询问下载 CLI；首次运行可能要求登录或关联项目，请自行确认提示。这是 [Vercel 官方本地开发方式](https://vercel.com/docs/cli/dev)，不要用裸 `vercel` 命令代替（它用于部署）。前端和 API 都通过 http://localhost:3000 访问。`vercel.json` 指定 Vite 框架与 dist 输出，不向 Vite 注入 API 中间件。

另开终端验证接口：

```sh
curl -i http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"npc":"kai","message":"今晚忙吗？","history":[]}'
```

预期返回 `{"reply":"模型生成的文本"}`。Kai / Mira 分别使用服务端角色 prompt。在浏览器点击 Mira，发送“你好”，再发送“你还记得我刚才说了什么吗？”，随后测试 Kai 一轮，检查 Network 中的 POST 和第二轮 history。

### 已执行验证与边界

```sh
node --test tests/chat.test.js tests/openrouter.test.js
npm run build
```

- API 与 OpenRouter 边界单元测试：13 项通过，涵盖服务端 system 选择、客户端 prompt 不可覆盖、两轮 messages、角色校验、缺少密钥、网络失败、非 2xx、无效 JSON、无效 content、超时及敏感详情不外传。测试 mock fetch，不读取 `.env.local`、不调用真实模型。
- Stage 2.1 已执行的 `tests/dialogue.browser.js` 是供 Playwright `browser_run_code_unsafe` 执行的浏览器测试脚本，明确使用 HTTP mock。已验证输入、中文输入法、Loading、重复发送、两轮 history、角色隔离、错误重试、切换取消、猫反馈及桌面/窄屏面板边界。
- Stage 2.1 浏览器验证时，正常页面 Console 无 error / warning；错误路径测试主动模拟了 HTTP 500。本轮按确认范围仅完成代码和服务端测试，未重新验证浏览器 Console。
- Stage 1 主图、构图、热区位置、HUD 和雨层未修改；没有新增 npm 依赖。
- Stage 2.2A 已直接调用实际 API handler 并请求 OpenRouter：Mira 两轮、Kai 一轮均为 200；Mira 第二轮正确回忆“你好”。测试日志仅输出状态和最终回复，没有输出原始上游 JSON / reasoning。
- Stage 2.2A 完整联调由用户确认已通过。本轮 Stage 2.2B 尝试启动缓存中的 Vercel CLI，但当前环境没有可用登录凭据，未重新完成浏览器 → API → 模型整链路测试；没有自行登录、关联或部署。
- Stage 2.2B：已复查前端人物点击、角色切换、关闭、猫反馈，Console 无 error / warning。前端代码、history state、场景和样式均未改动；history 仍由 App 按 NPC 分开传入。

### Stage 2.2B 真实模型验证记录

服务端调用实际 `/api/chat` handler → OpenRouter；不是 HTTP mock。Kai 的爱好回答围绕值夜和商品，困意回答为两句短话；Mira 出现论文 / deadline、熬困与电脑文档的处境。Kai、Mira 各自的“我叫西瓜”→“我叫什么”均成功；在告诉 Mira 姓名前，她回答不知道仅告诉 Kai 的名字，隔离测试通过。

最后一轮固定 11 个问题中 10 个成功、1 个无效回复 502（Mira 的“为什么这么晚”）；之前该题重试曾返回论文 deadline 的回答。早期还遇到一次超时、分析正文和安全分类正文。已补强只输出台词的约束、reasoning 配置和最小异常校验，沿用原有错误 UI；不自动重试、不切换模型、不用固定回复冒充成功。Kai 一次身份回答偏刻薄，最后追加了“幽默不贬低玩家”的约束。补充约束后的两项定点复查均返回 200：Kai 自称夜班店员，Mira 回应论文 deadline；没有重复刻薄表达。角色语气仍需用户验收，不能把有限成功样本视为稳定性保证。

## Stage 2.2C：Model Selection & Dialogue Quality

当前服务器端使用原生 fetch 调用 `https://openrouter.ai/api/v1/chat/completions`，模型从服务端 `process.env.OPENROUTER_MODEL || "openrouter/free"` 读取；未设置或为空时使用 `openrouter/free`。密钥仅从 `process.env.OPENROUTER_API_KEY` 读取；本地放在被 Git 忽略的 `.env.local` 中，不要使用 `VITE_` 前缀，也不要把密钥放入源码或提交到 Git。

OpenRouter 请求设置 `reasoning: { enabled: false }`，即 `reasoning.enabled = false`。`max_tokens` 保留为 512；短对话长度仍由 Stage 2.2B 的角色提示词约束，不截断字符串。Character Prompt、Kai / Mira personality、per-NPC history、DialoguePanel 和 API 契约保持不变。

### 本地环境变量

由开发者自行在 `.env.local` 配置以下变量（示例仅含占位密钥）：

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

模型 ID 和密钥仅由服务端读取，不加 `VITE_` 前缀，不放入前端请求或 API 回复。修改后重启本地 API 服务；`.env.local` 已被 Git 忽略。本轮未读取或修改该文件，所选模型以开发者已有手动实测为依据。

### Stage 2.2C 验证记录

- API 与 OpenRouter 边界单元测试：15 项通过，涵盖模型环境变量选择、未设置/空值 fallback、客户端 model 不可覆盖、模型元数据不外传、reasoning 关闭、512 token 上限、服务端 system 选择、客户端 prompt 不可覆盖、两轮 messages、角色校验、缺少密钥、网络失败、非 2xx、无效 JSON、无效 content、超时及敏感详情不外传。测试 mock fetch，不读取 `.env.local`、不调用真实模型。
- `npm run build` 通过。本阶段测试使用 mock，未调用真实模型；不包含任何真实 API Key。

## Stage 2.3：Dialogue Reliability & Fallback

主模型读取 `process.env.OPENROUTER_MODEL || "openrouter/free"`，备用模型读取 `process.env.OPENROUTER_FALLBACK_MODEL || null`。备用模型未配置、为空或与主模型相同时，不额外请求。由开发者自行在 `.env.local` 配置并重启 API 服务：

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_FALLBACK_MODEL=nvidia/nemotron-3.5-lightning:free
```

示例不包含真实 API Key。两个模型配置和密钥均只在服务端使用；本阶段不读取或修改 `.env.local`，该文件继续被 Git 忽略。

`server/openrouter.js` 只构造一次 Character Prompt、当前 NPC 的 history 和当前 message：先请求 primary；成功立即返回；明确的临时故障立即请求 fallback 一次。不重试 primary，不循环切换。两次请求仅 model 不同，`reasoning: { enabled: false }`、`max_tokens: 512`、非 streaming 和其他配置一致。两次请求共用原有 45 秒总时限；总时限耗尽后返回现有 504，不再启动 fallback，前端 60 秒等待上限不变。

切换条件：

- HTTP 502 / 503 / 504，以及可识别的临时 fetch / 网络连接故障。
- HTTP 429：只有 `error.metadata.limit_source` 明确为 `upstream_provider_shared_pool`、`provider_overloaded` 或 `provider_temporary_rate_limit` 才切换。如果没有 limit_source，仅接受明确的 `provider_overloaded`、`provider_unavailable`、`provider_temporary_rate_limit` error_type；不会仅凭 provider 名称或泛化的 rate limit 文本推断。
- HTTP 500 / 529 也必须携带上述明确的临时 provider 分类；普通 500 不切换。HTTP 200 响应内的显式 `error.code` 使用相同规则，兼容生成过程中上游报告的错误。错误响应格式参考 [OpenRouter 错误文档](https://openrouter.ai/docs/api_reference/errors-and-debugging)；metadata 不足时保守地不切换。

不切换：400 / 401 / 402 / 403 / 404、缺少密钥、本地配置或校验错误、不可识别的程序异常、账户限流、每日免费额度或 quota 耗尽、来源不明的 429。明确的未知或账户级 limit_source 优先于其他 provider 提示，BYOK 限流不切换。无效 JSON、空回复或分析正文不作为切换理由，继续沿用原来的安全错误处理。

两次均失败时只返回现有友好 `{ error }`。成功始终只返回 `{ reply }`；前端不知道模型切换，不接收模型名称、provider metadata、reasoning 或原始错误内容。角色提示词、每个 NPC 独立的最近 20 条 / 10 轮 history、DialoguePanel、loading / retry 和 Stage 1 场景保持不变。

### Stage 2.3 验证

```sh
node --test tests/*.test.js
npm run build
```

自动测试全部 mock fetch，不读取本地凭据、不调用真实 OpenRouter。覆盖主模型一次成功、502/503/504 切换、provider 与账户 429 区分、认证和配置错误不切换、两次均失败、上下文完整性、客户端无法覆盖模型、reasoning / token 配置，以及共用超时预算。

本阶段 Node 测试共 55 项通过，`npm run build` 成功。已有 `tests/dialogue.browser.js` 依赖旧 Playwright 工具的 `page.route`，当前浏览器接口不支持该 mock 能力，未重跑这一整套脚本；只复查了 Kai / Mira 面板打开、切换、关闭和猫反馈。没有执行真实 OpenRouter 自动测试。

## Stage 3.1：NPC State Foundation（历史，已移除）

> 以下记录为当时实现；Stage 4 收尾已移除这些关系状态、递进规则和提示词。当前 API 不要求或使用 npcState，以后文 Stage 4 Closeout 为准。

NPC runtime state 是当前页面内的结构化角色状态容器，与 conversation history 独立。初始值集中在 `src/data/npcState.js`，通过 `createInitialNpcState()` 创建；每次调用都会生成独立对象，默认值和返回的快照只读，避免跨角色或跨 session 共享可变引用。当前字段都是基本类型。

```js
{
  kai: { mood: 'neutral', familiarity: 0, trust: 0, hasMetPlayer: false },
  mira: { mood: 'exhausted', familiarity: 0, trust: 0, hasMetPlayer: false, deadlineStress: 'high' }
}
```

`src/hooks/useNpcStates.js` 使用 React `useReducer` 保存 `npcStates`，在 `App` 顶层实例化，生命周期与页面一致。切换 NPC 或关闭 DialoguePanel 不会卸载这个容器；刷新或重新挂载 App 后回到初始值。Cat 保持原有本地反馈，没有新增 state。没有数据库、localStorage 或其他持久化。

hook 提供四个入口：

- `npcStates`：以 NPC id 为键的只读快照。
- `getNpcState(npcId)`：取得指定角色当前快照。
- `updateNpcState(npcId, updater)`：updater 接收该角色最新只读 state，返回部分字段对象；合并时仅替换该角色，不覆盖另一个角色，批量更新也使用最新值。
- `resetNpcState(npcId)`：仅将指定角色恢复为新建的初始快照。未知 NPC 会报错；updater 必须是返回对象的纯函数，不能直接修改快照。

Stage 3.1 只提供这些容器操作，正式游戏没有调用 update/reset 的规则。测试中的 trust 增量仅验证更新机制，聊天、点击、关闭等事件不会自动改变 mood、trust、familiarity 或 hasMetPlayer。

history 仍记录每个 NPC 最近 20 条 / 10 轮对话；runtime state 则保存角色属性，二者没有互相写入。state 不传给 DialoguePanel、`/api/chat`、OpenRouter 或 system message，不影响 NPC 回复、模型选择、fallback 和现有错误处理。游戏界面不显示任何 state 数值或 debug HUD。

state transition rules 留待 Stage 3.2；state-aware dialogue 留待 Stage 3.3。本阶段没有实现这些后续能力或长期 memory。

### Stage 3.1 验证

```sh
node --test tests/*.test.js
npm run build
```

Node 测试共 62 项通过：新增 7 项 state / API contract 测试，原有 55 项（包括 Stage 2.3 fallback）继续通过。更新、reset、初始值、不可变快照、独立 session 和前端请求不携带 state 均已覆盖。所有请求测试均 mock fetch，未调用真实 OpenRouter。

`tests/runtime.browser.html` 是独立的 React 浏览器测试页，仅用于验证，不进入生产构建。它在页面内 mock fetch，使用 React `act` 检查真实 hook 与 App，弥补旧浏览器脚本对 `page.route` 的依赖。26 项检查通过，包括批量 state 更新、选择/关闭后的保留、重新挂载重置、Kai/Mira 打开及切换、对话发送、输入法 Enter、loading 防重复、失败重试、取消请求、history 隔离及 20 条上限、猫反馈和无 debug UI；Console 无 error/warning。旧 `tests/dialogue.browser.js` 保留，未直接执行该旧脚本。

本轮本地浏览器测试通过 `createServer({ envFile: false })` 禁用环境文件加载；构建使用临时配置继承原 `vite.config.js` 并设置 `envDir: false`，通过 `npm run build -- --config ...` 成功完成。没有读取或修改 `.env.local`，也没有改变项目 Vite 配置或新增依赖。

## Stage 3.2：NPC State Transitions（历史，已移除）

> 以下记录为当时实现；Stage 4 收尾已移除这些关系状态、递进规则和提示词。当前 API 不要求或使用 npcState，以后文 Stage 4 Closeout 为准。

状态规则集中在 `src/game/npcStateTransitions.js` 的纯函数 `applyNpcStateEvent(npcId, currentState, event)` 中。目前只支持 `dialogue_completed`：首次成功对话将 `hasMetPlayer` 设为 `true`；每次成功对话让 `familiarity + 1`，用 `Math.min(currentState.familiarity + 1, 5)` 限制最大值为 5。函数不修改输入，不依赖 React、history、网络或存储；未知 event 原样返回当前 state，Cat / 未知 NPC 抛出与现有 state API 一致的 RangeError。

`App.completeTurn()` 仍先按原逻辑写入 history，再通过 `updateNpcState()` 对本次 NPC 应用一次 `dialogue_completed`。规则没有放进组件或请求层。前端收到有效、未取消的 API 回复后才调用这个入口，不做 optimistic update。primary 失败但 fallback 成功时，前端只收到一个成功回复，因此只增加一次 familiarity。

API 失败、两模型均失败、超时、取消、空白或过长输入、无效回复、尚未完成的请求都不会改变 state。打开、关闭、切换面板、Stage 1 固定选项和点击 Cat 也不会触发事件。补充了超时后的迟到回复检查：即使回复已缓冲，也不能在 signal 已取消后写入 history 或触发成功事件，仍使用现有错误提示。

Kai / Mira 完全独立；例如 Kai 成功两次、Mira 成功一次，对应 familiarity 为 2 / 1。`trust`、`mood`、Mira 的 `deadlineStress` 不自动变化。state 继续只保存在当前页面的 React 内存中，刷新重置，不持久化。

请求 body 仍然只有 `npc`、`message`、`history`。state 不发送给 `/api/chat`、OpenRouter、Character Prompt 或 system message，本阶段不会因为 familiarity 改变说话方式。state-aware dialogue 留待 Stage 3.3；没有加入语义分析、trust/mood 规则、关系 UI 或长期 memory。

### Stage 3.2 验证

```sh
node --test tests/*.test.js
npm run build
```

新增 `tests/npc-state-transitions.test.js`，验证首次成功、多轮累计、上限、隔离、其他字段不变、确定性、不修改输入及未知 event/NPC。使用真实 API handler 加 mock fetch 验证 primary 502 → fallback 成功只产生一个完成事件，以及两模型均失败不产生事件。原 Stage 2.3 fallback 和 Stage 3.1 state 测试保持通过。

`tests/runtime.browser.html` 继续作为独立测试入口，测试实际 App 的 Kai 0→1→2 / Mira 0→1 流程、失败/重试/取消/超时及迟到回复、面板/固定选项/Cat 无副作用、熟悉度上限、history 完整性、刷新生命周期和 API payload。App 仅在开发模式接受可选只读 `onNpcStateChange` 观察回调，供测试读取冻结快照；正式游戏不提供该回调，不显示 debug UI，生产构建移除回调调用。

本阶段 71 项 Node 测试、50 项 React/浏览器检查全部通过，Console 无 error/warning，`npm run build -- --config ...` 成功。验证不调用真实 OpenRouter，不读取或修改 `.env.local`。沿用 Stage 3.1 禁用环境文件加载的本地测试服务器和临时构建配置；未修改 Vite 配置或依赖。

## Stage 3.3：State-Aware Dialogue（历史，已移除）

> 以下记录为当时实现；Stage 4 收尾已移除这些关系状态、递进规则和提示词。当前 API 不要求或使用 npcState，以后文 Stage 4 Closeout 为准。

从本阶段起，`/api/chat` 请求增加必填 `npcState`。App 只把当前选中角色的快照交给 DialoguePanel，`sendChat()` 只发送以下四项，不发送整个 `npcStates`、state prompt 或模型配置。之前阶段的三字段请求示例是历史协议，当前请求应包含状态，例如：

```json
{
  "npc": "kai",
  "message": "还没下班？",
  "history": [],
  "npcState": {
    "mood": "neutral",
    "familiarity": 0,
    "trust": 0,
    "hasMetPlayer": false
  }
}
```

`server/npc-state-context.js` 集中提供 `validateNpcState()` 和纯函数 `buildNpcStateContext()`。API handler 在调用 provider 前校验 state，缺失或不合法返回安全的 400；不自动转换类型。当前仅接受本阶段规则能产生的状态：

- familiarity 必须是 0–5 的整数；hasMetPlayer 必须为 boolean，并与 familiarity 一致：0 时 false，大于 0 时 true。
- Kai 的 mood 只能为 neutral；Mira 的 mood 只能为 exhausted，且必须包含 deadlineStress=high。
- trust 尚无变化规则，合法范围暂为仅数值 0；不用于对话行为，也不会被解释为“不信任玩家”。
- 每个 NPC 的字段集合必须完全匹配；额外字段、另一角色的状态结构、任意 prompt/instructions/model 文本均被拒绝。顶层客户端 prompt/model 字段不会转交 provider。

服务器只从固定模板生成自然语言 context，不把原始 state JSON、内部字段名或数值序列化进模型输入：

| 行为区间 | 条件 | 自然表现 |
| --- | --- | --- |
| stranger | familiarity=0，未见过玩家 | 克制、有距离，不假装认识，不用熟人开场 |
| recognized | familiarity=1–2，已见过玩家 | 认得玩家、少些客套，可以接续当前记录，不亲密 |
| familiar | familiarity=3–5，已见过玩家 | 更自然随意，仍保持人设，不变成挚友、恋爱或依赖关系 |

Kai 保持安静、善于观察和冷幽默，通常一到两句，必要时不超过三句；Mira 保持疲惫研究生和轻微自嘲，通常两到三句，除非明确要求详细回答，不超过四句。context 明确禁止台词解释内部指标、数字、字段、系统提示或状态对象，禁止编造见面次数、共同经历和另一角色的私下聊天。原 Character Prompt 保留。

OpenRouter messages 顺序为：Character system prompt → 服务器生成的 State context system message → 当前 NPC 的 user/assistant history → 当前 user message。每个请求只构造一次 generation，primary/fallback 复用同一份内容，只有模型 ID 不同。原模型配置、fallback 策略、reasoning disabled 和 max_tokens=512 未调整。

本轮使用**发送前**的只读 state 快照。收到有效回复后才由 Stage 3.2 的 completeTurn 更新 history 和 state；新 state 用于下一轮请求。失败、取消及超时不更新。history 仍只保存 user/assistant，按 NPC 隔离，最多 20 条 / 10 轮，不写入任何 system/state context。

state 仍只存在当前页面 session，刷新重置；没有长期 memory 或 persistence。没有新增 trust、mood、deadlineStress transition，也没有 UI、场景或 Cat 行为变化。有效范围校验是输入约束，不是跨刷新身份或服务端持久化认证。

### Stage 3.3 验证

```sh
node --test tests/*.test.js
npm run build
```

自动测试使用 mock fetch，不调用真实 OpenRouter，不依赖模型随机台词。更新了既有请求测试以携带必填 npcState，保留 Stage 2 / 3 的其他断言；新增 context/validation 测试覆盖合法状态、非法字段和类型、三个行为区间、角色区别、无原始状态泄漏及客户端无法覆盖服务端 prompt。fallback 测试检查两次 messages、context、history 和 generation 配置完全一致。

独立 React 测试页检查 Kai / Mira 各自从 stranger 到 recognized 再到 familiar 的请求快照、失败重试时快照不变、每轮先请求后更新、history 不含 system/state 消息、无 debug UI。沿用禁用环境文件加载的本地测试服务器和临时构建配置；没有读取或修改 `.env.local`。这些检查验证确定性的上下文构造与数据流，不替代真实模型语气的人工验收。

本阶段 78 项 Node 测试、62 项 React/浏览器检查全部通过，Console 无 error/warning。构建通过 `npm run build -- --config ...` 成功完成，临时配置继承项目配置并设置 `envDir: false`，避免加载环境文件；项目 Vite 配置和依赖未修改。

## Stage 4.1 — Ambient NPC Behavior Foundation

新增独立的、session-local 的 ambient activity runtime。`src/data/npcActivities.js` 集中定义活动顺序、初始活动和计时间隔；`src/game/npcActivityTransitions.js` 的纯函数 `nextNpcActivity(npcId, currentActivity)` 校验角色和活动后返回下一项，未知角色、无效或串用其他角色的活动会抛出 RangeError。

| NPC | 活动循环（第一项为初始活动，最后一项回到第一项） | 间隔 |
| --- | --- | --- |
| Kai | behind_counter → making_coffee → checking_shelf → looking_out_window | 37 秒 |
| Mira | reading_notes → checking_phone → choosing_drink → staring_out_window | 53 秒 |
| Cat | sleeping → grooming → watching_door → wandering | 71 秒 |

`useNpcActivities()` 使用独立 useReducer 和不可变快照，每个 NPC 始终对应一个有效活动字符串。提供 `getNpcActivity(npcId)`、`setNpcActivity(npcId, activity)`、`advanceNpcActivity(npcId)`、`resetNpcActivities()`。重置恢复全部初始活动，不重启计时；刷新或重新挂载 App 会重新开始整个 session。

每个 NPC 使用一个独立 setInterval，首次切换分别发生在各自间隔之后。effect 清理所有计时器，Strict Mode 不会留下重复计时器；普通重渲染不重启计时。hook 可接受 `{ intervals: { kai, mira, cat } }` 供测试配置，修改间隔时替换旧计时器。生产使用上述慢速错开间隔；后台标签页可能被浏览器节流，不进行离线追赶或时间持久化。

App 将 activities 传给场景，再将 currentActivity 传给对应 NPC hotspot，仅写入非视觉的 `data-activity`。没有新增 debug 标签、行走动画或位置变化，场景图、hotspot 坐标和 DialoguePanel 保持原样。Stage 4.2 才会把活动映射到位置或动画；例如当前 Cat 的 wandering 只是活动数据，不会移动图片中的猫。

Ambient activity 与 Stage 3.x relationship/dialogue npcState 完全独立：不会改变 familiarity、trust、mood 或 deadlineStress，不会写入 history，也不会发送到 `/api/chat` 或触发自动 LLM 请求。对话进行中活动仍可缓慢推进，不打断输入或请求；活动与对话的连接留待 Stage 4.3。没有数据库、localStorage、新依赖或持久化。

### Stage 4.1 验证

`node --test tests/*.test.js`：87 项通过，包括新增活动循环、初始状态、不可变更新、角色隔离、非法输入、重置和 API 数据边界测试。既有 Stage 2 / 3 测试未删减。

独立 `tests/runtime.browser.html`：85 项 React/浏览器检查通过，包含原有 62 项检查。新增测试以虚拟 interval 时钟验证慢速错开计时、批量更新、Strict Mode 清理、间隔变更、卸载、重新挂载和对话独立性，不需要等待真实几十秒。完成的测试运行 Console 无 error/warning；仅使用 mock fetch，不调用真实 OpenRouter。

生产构建成功：沿用禁用环境文件加载的临时配置执行 `npm run build -- --config ...`，继承项目配置并设置 `envDir: false`。没有读取或修改 `.env.local`，也未修改项目 Vite/Vercel 配置或依赖。

## Stage 4.2A — NPC Visual Layer Foundation

新增独立 Scene Position Model：`src/data/npcSceneLocations.js` 集中定义各 NPC 的合法逻辑地点与 activity → location 映射；纯函数 `getNpcSceneLocation(npcId, activity)` 位于 `src/game/npcSceneLocation.js`。函数复用已有活动校验，拒绝未知 NPC、无效活动和跨角色活动，确定性地返回合法逻辑地点。

| NPC | Activity → logical location |
| --- | --- |
| Kai | behind_counter → counter；making_coffee → coffee_station；checking_shelf → shelf；looking_out_window → window |
| Mira | reading_notes / checking_phone → notes_spot；choosing_drink → fridge；staring_out_window → window |
| Cat | sleeping / grooming → floor；watching_door → door；wandering → aisle |

`drink_area` 和 `shelf_corner` 是已定义但当前未使用的逻辑地点。地点名表达活动所对应的逻辑位置，不代表背景图里的角色已经到达那里；本阶段没有地点坐标或位置转换。

ConvenienceStoreScene 从现有 activities 直接推导 logicalLocation，再传给 NPC 的非视觉 `data-location`。不新增位置 state/hook，不复制 ambient runtime，不与 relationship state 合并。relationship state、ambient activity、derived scene location 保持三个独立层；activity/location 均不进入 `/api/chat` 或 conversation history，原 Character Prompt、state-aware dialogue、OpenRouter fallback 和定时器不变。

**没有可见移动。** 当前背景图仍然包含烘焙好的 Kai / Mira / Cat；图片、hotspot 坐标、标签、CSS 和 DialoguePanel 均未调整，没有新增精灵或 debug UI。Stage 4.2B 必须先准备独立 NPC 视觉资产和移除原有 NPC 的干净背景，才能在本层之后增加 logicalLocation → coordinates → sprites → movement transitions，避免双重角色画面。本阶段未实施这些后续步骤。

### Stage 4.2A 验证

`node --test tests/*.test.js`：97 项通过，覆盖全部合法活动映射、确定性循环、非法及跨角色输入、不可变配置、relationship state 独立、原 hotspot 坐标和不变的 API payload。

`tests/runtime.browser.html`：100 项 React/浏览器检查通过，保留已有回归，并逐一渲染所有活动验证逻辑地点、热点/标签/图片和可见 DOM 不变。DOM 比较仅忽略非视觉的 `data-activity` / `data-location`，另有独立断言检查它们的正确值。测试运行 Console 无 error/warning，全部对话请求使用 mock fetch。

生产构建成功，沿用禁用环境文件加载的临时配置执行 `npm run build -- --config ...`。没有读取或修改 `.env.local`，没有更改 Vite/Vercel 配置、图片、依赖或服务端代码。

## Stage 4.2B — Independent NPC Visual Assets & Movement

活动首次驱动可见位置：`currentActivity → getNpcSceneLocation() → logicalLocation → getNpcSceneAnchor() → NPC entity`。位置始终是派生数据，没有新增 position state 或 movement timer；沿用 Stage 4.1 的 37 / 53 / 71 秒活动节奏。

主场景使用 `/assets/scenes/after-hours-clean.png`，原场景尺寸 1536×1024、响应式取景、雨层和 DialoguePanel 保持不变。原 `/assets/scenes/after-hours.png` 仍保留，但不再参与活动场景渲染。独立精灵使用 `/assets/npcs/kai.png`、`mira.png`、`cat.png`，路径、原始尺寸和相对场景宽度集中在 `src/data/npcVisuals.js`。

收到的四张素材实际位于 `public/assets/npcs/stage-4-2b-assets/`。本轮仅将其原样复制到上述正式路径；测试验证复制文件与来源逐字节一致。没有重新生成、编辑 PNG，也没有使用或删除 `public/art/` 旧素材。

`src/data/npcSceneAnchors.js` 按 NPC 和逻辑地点集中定义 `{ x, y, scale, zIndex }`。x/y 是完整场景图的百分比，锚点原点为精灵图片的底边中心；所有逻辑地点均有映射，包括暂未被活动使用的 drink_area / shelf_corner。`src/game/npcSceneAnchor.js` 的纯函数拒绝未知角色、无效地点和不属于该 NPC 的地点。

每个 NPC 是一个 button entity，内部包含透明精灵、名称和交互提示。实体统一承担位置、缩放、层级与点击区域，取代原固定 hotspot；Kai/Mira 保持打开各自对话，Cat 保持本地反馈。图片保持原始宽高比、不可拖拽，不新增重复 NPC。

位置变化使用 2.4 秒 ease-in-out CSS transition（left/top/transform）；相同地点的连续活动不会移动，例如 Mira 读笔记→看手机、Cat 睡觉→梳理。支持系统 reduced-motion。柜台遮挡通过同一张干净背景的局部前景复用实现：`scene.counterOcclusion` 集中定义裁剪区域，Kai 在柜台/咖啡台使用后方层级，离开柜台后使用前方层级。前景不接收点击，不包含旧角色画面。

关系状态、familiarity tiers、Character Prompt、history、OpenRouter/fallback、环境变量和 Vercel 配置不变。activity/location/coordinates 不发送到 `/api/chat`，Stage 4.3 才会连接活动与对话；本轮没有真实模型自动调用或新依赖。

### Stage 4.2B 验证与边界

Node 测试覆盖干净背景、透明素材及复制完整性、全部逻辑地点锚点、非法输入、完整派生链、相同地点不移动和不变的 API payload。浏览器回归覆盖三个独立精灵、热点跟随、实际百分比坐标、CSS 过渡、角色点击、重挂载重置和原有对话测试。原 Stage 4.2A 的“不可移动”断言按本阶段目标升级为移动实体断言，其他阶段的行为约束继续保留。

本阶段 `node --test tests/*.test.js` 共 110 项通过；浏览器回归 131 项通过，并在桌面与 390×844 窄屏检查了布局和实际角色点击，Console 无 error/warning。生产构建通过 `npm run build -- --config ...` 成功，沿用继承项目配置、设置 `envDir: false` 的临时配置，避免加载 `.env.local`；未修改项目构建配置。

这是第一轮锚点标定：柜台/咖啡台的遮挡边界，以及 window、shelf、aisle 附近的落点仍值得人工微调。当前直接插值，不绕开货架，不处理复杂遮挡或碰撞；层级按目的地设置。精灵仍是单张静态姿势，猫移动时也保持趴卧外观。Walking animation / pathfinding 有意延后，不作为本轮新增系统。

## Stage 4.2C — NPC Walking Animation

### Stage 4.2C-1 — Kai Walking Animation

Kai 移动时使用四帧方向精灵：左右共用 `kai-walk-side.png`，向左镜像；向下使用 `kai-walk-front.png`，向上使用 `kai-walk-back.png`。素材位于 `public/assets/npcs/kai/`，PNG 保持原样。`kaiWalking.js` 记录帧内透明留白的对齐信息，保持脚底基线和宽高比；CSS 以 8 fps 循环播放，到达后恢复原 `kai.png`。

位置仍由 activity → logicalLocation → anchor 派生。`npcMovement.js` 根据前后锚点的主轴判断方向，`useNpcMovement` 只管理临时行走状态，沿用 2.4 秒直接过渡；反向过渡提前完成时也恢复站姿。目标变更取消旧计时器，卸载清理计时器和监听器，支持 Strict Mode 与 reduced-motion。精灵、标签和点击区域仍属于同一个 NPC entity，缩放、层级和点击对话不变。

未修改 ambient timing、关系状态、history 或 API；动画数据不进入请求。Mira / Cat 继续使用原静态精灵移动。绕开货架的 waypoint routing 留到 Stage 4.2C-2，Mira / Cat 行走动画留待后续。

验证命令仍为 `node --test tests/*.test.js`、浏览器打开 `/tests/runtime.browser.html` 和 `npm run build`。新增检查覆盖四方向、镜像、逐帧播放、到达站姿、连续改目标、卸载清理和原有对话回归。旧素材副本已从工作区移除，因此素材完整性测试改为校验原图 SHA-256，不依赖重复文件。

### Stage 4.2C-1.5 — Kai Movement Polish & Development Test Harness

本阶段替代 Kai 固定 2.4 秒的过渡；Mira / Cat 仍保持原样。`src/game/npcMovement.js` 集中配置 Kai 的速度与节拍：1536×1024 场景坐标中的 155 px/s、8 fps、四帧一周期、时长下限 500 ms / 上限 8000 ms、到达收势 125 ms。距离先按场景宽高换算成像素，再计算时长并取最近的完整 500 ms 步态周期。极短/极长距离受上下限约束；正常路线中的量化误差不会随窗口尺寸改变。

位置使用 linear 过渡，单段保持同一个主轴朝向。中断时只读取 DOM 当前呈现的位置作为新段起点，再使用原逻辑地点对应的目标锚点，不新增位置状态。旧完成回调和收势回调均失效，避免跳回旧位置或提前恢复站姿。四方向共享固定显示框，以同一底部基线对齐原图；到达后停止帧循环，125 ms 淡回原站姿，不新增弹跳。到达后没有持续计时器，卸载清理监听器与计时器。

**立即测试移动：**

1. 在项目目录运行 `npm run dev`。
2. 打开终端显示的本地地址，并加上 `/tests/movement.html`，例如 `http://localhost:5173/tests/movement.html`。
3. 点击 `counter`、`coffee_station`、`shelf`、`window`，或反复点击 `Next →`。刷新后从 counter 开始，无需等待 ambient interval。
4. 连续点不同目的地可验收中断；正常页面仍是 `/`。

页面位于 `tests/`，由 `import.meta.env.DEV` 限制，并复用真实 ConvenienceStoreScene / NPC / KaiSprite。只在 fixture 内手动选择已有 Kai 活动，不挂载游戏 App、环境计时器、关系状态或 DialoguePanel，不调用 `/api/chat`。正常入口不导入它；生产 build 不包含测试页面或可见调试控件。本页只用于移动验收，不能用来测试聊天。

新增验证覆盖距离/上下限、固定帧框和脚底、完整播放与收势、旧回调失效、真实 CSS 中断连续性、匀速位移、开发入口隔离，以及原有 ambient / relationship / dialogue 回归。运行 `node --test tests/*.test.js`，并用浏览器打开 `/tests/runtime.browser.html` 查看完整回归结果。

本阶段验证：114 项 Node 测试、桌面与 390×844 窄屏各 237 项浏览器检查、reduced-motion 169 项检查通过，Console 无 error/warning。生产构建通过；构建预览中普通页面和测试路径均不显示移动控件。

### Stage 4.2C-2 — Waypoint Navigation & Scene Depth Polish

Kai 现在使用 `src/data/sceneWaypoints.js` 中集中定义的手工通道图。四个原目的地的 x/y 保持不变，新增柜台内通道、柜台出口、冷柜前通道、窗侧通道和门口通道，共 9 个节点、8 条双向连接。柜台内的投影坐标沿用既有前景遮挡；公共走廊沿货架外侧布置，没有开放任意两点之间的直线捷径。

`src/game/npcRoute.js` 使用小型确定性 BFS 遍历已批准的连接，返回中间路点与最终目的地，拒绝未知节点；配置冻结，调用者不能修改它。没有 A*、navmesh、碰撞或物理引擎。例如：

- counter → counter_lane → counter_exit → shelf
- coffee_station → counter → counter_lane → counter_exit → shelf
- shelf → fridge_front → window_lane → door_lane → window

每段继续使用既有距离时长模型和方向选择。段间保持 walking，复用同一个步态动画，不插入 idle、不重新挂载播放层；整条路线完成才进行 125 ms 收势。中途更换目的地时读取当前显示位置，仅比较沿当前边继续到端点或折返的路线，禁止跨家具跳到其他“最近节点”。旧计时器/回调失效，导航进度只记录当前节点或边，不改变 activity / logicalLocation / relationship / dialogue state。

`src/game/sceneDepth.js` 将 Kai 的缩放统一为后方 .92 到前方 1.06，目的地与中间路点共用同一规则。缩放随每段位置一起插值，transform-origin 仍为底边中心；底部低透明椭圆渐变阴影随实体缩放，不使用滤镜。柜台后方为 layer 1，现有柜台前景为 layer 2，公共走廊按节点深度使用 3–5。走出出口后才切换到公共区域层级；反向进入时由原有剪裁遮挡重叠部分。`sceneForegroundLayers` 注册真实前景层，便于以后增加经过校准的遮挡。

**路线可视化：** 开发服务器的 `/tests/movement.html` 保留四个目的地和 Next；勾选默认关闭的 **Show route debug**，显示路点名称、通道边、解析路线、当前段与目的地。图层只存在于开发 fixture，正常游戏与生产构建不包含调试控件。页面仍不挂载 ambient 定时器或对话、不请求 `/api/chat`。

原有图片均未改动。背景仍是合成平面图，只有已注册的柜台前景能真正遮挡角色；层级不能替代未拆分的货架/冷柜遮罩。路线避免主要家具占地，但边缘、原柜台落点投影和角色间重叠仍可能需要人工标定。Mira / Cat 的路线行走有意延后，本阶段不修改它们的现有行为。

本阶段验证：136 项 Node 测试通过；桌面与 390×844 窄屏各 302 项浏览器检查通过，覆盖逐段导航、连续步态、中断、脚底与缩放、移动测试页及原有运行时回归，Console 无 error/warning。生产构建通过，生产入口没有路线调试控件。

### Stage 4.2C-3 — Kai Sprite Asset Quality Correction

本轮先修正 Kai 素材质量，再等待美术验收决定是否继续移动打磨。以原始 `public/assets/scenes/after-hours.png` 中的店员为主要参考，通过内置 imagegen 重建统一母版：站姿 1 帧、侧向 / 正面 / 背面行走各 4 帧。缩小眼部高光，恢复克制的深色眼睛、碎发轮廓、蓝色制服与深色围裙，增强跨步和摆臂轮廓。

运行时仍使用 `public/assets/npcs/kai.png`（351×988）和 `public/assets/npcs/kai/kai-walk-{side,front,back}.png`（各 2048×768）；左向继续镜像侧向。原始生成母版、逐帧登记和提示词保存在 `art-source/kai-stage-4-2c-3/`，不由前端导入。仅更新 `kaiWalking.js` 的帧登记与 CSS 显示高度，以对齐新素材脚底；路线、速度、帧率、环境调度和对话代码保持不变。没有新依赖。

使用既有 `/tests/movement.html` 验收场景尺寸下的面部、衣着、步幅和站姿切换；本阶段不宣称生成帧已达到最终手工逐像素动画质量，侧向四帧的腿部交替与细微轮廓稳定性仍需目视确认。详细资产来源与导出规则见 `art-source/kai-stage-4-2c-3/README.md`。

本轮替换后验证：136 项 Node 测试、302 项浏览器回归通过，生产构建成功。四张运行时 PNG 保持原尺寸，透明边缘为二值 alpha；没有新增依赖。测试确认集成与播放正常，美术定稿仍以场景内目视验收为准。

### Stage 4.2D — Mira Walking Integration

Mira 现在与 Kai 共用 `useNpcMovement`、确定性路由、距离时长、逐段方向和 `WalkingSprite` 帧渲染器。Kai 仍是已验收的参考实现，原素材、路点、速度、帧率和基础尺寸不变。Mira 保留 `reading_notes / checking_phone → notes_spot`、`choosing_drink → fridge`、`staring_out_window → window`；只有目的地改变才走动，段间不回 idle，到达后收势；中途改目标复用当前通道上的 latest-target-wins 行为。

新增四个 `mira_*` 目的地叶节点，复用 `fridge_front` 和 `window_lane` 通道，不增加 Kai 的捷径。`mira_window` 与 Kai 的 `window` 明确区分。已有 `drink_area` 锚点也已连接，但不新增活动去使用它。Mira 的场景坐标和基础宽度 5.76% 保留，远近缩放统一使用既有 .92–1.06 人形深度曲线，脚底仍为 bottom-center。

Mira 的站姿与侧 / 正 / 背向各四帧位于 `public/assets/npcs/mira/`。以原始便利店图为主要参考生成，保留长发、发带、外套、百褶裙和背包；左向镜像侧向。母版、提示词和导出登记见 `art-source/mira-stage-4-2d/README.md`。没有新依赖；背景和其他角色 PNG 未改。

在开发页 `/tests/movement.html` 的 **Test NPC** 中选择 **Mira**，可立即触发 **notes_spot / fridge / window / Next**；勾选 **Show route debug** 查看她的路线和当前段。Kai 原测试能力保留，控件不会进入生产页面。测试页不启动 ambient 计时器、不请求 API、不改变关系或对话状态。

运行 `node --test tests/*.test.js`、浏览器 `/tests/runtime.browser.html` 和 `npm run build` 验证。共享逐段与四方向播放测试分别覆盖 Kai 和 Mira；另外检查全部目的地连通、热点跟随、中断、场景状态与接口隔离。Cat 保持原来的静态精灵移动，行走动画推迟到 Stage 4.2E。四帧步态的细节、背包与裙摆稳定性，以及平面背景缺少货架前景遮罩的限制，留待后续最终视觉打磨。

本阶段验证结果：160 项 Node 测试、434 项浏览器回归通过；生产构建成功，生产入口不包含调试控件，Mira 对话面板正常打开，Console 无 error/warning。手动确认 notes_spot → fridge_front → window_lane → mira_window 到达后恢复 idle。API 测试使用既有 mock 边界，没有在本阶段发起真实模型请求。

### Stage 4.2D-1 — Mira Visual Fidelity & Scale Correction

仅修正 Mira 素材与基础尺寸。以当前已验收的 Kai 为像素处理和人形比例参考，以原便利店场景保留 Mira 的长发、发带、服装与背包身份，重绘 idle 及侧 / 正 / 背向各四帧。简化眼睛、发丝与阴影，增强块状轮廓；本轮没有修改 Kai、Cat、背景、路线、速度、方向、环境行为或对话。

`src/data/npcVisuals.js` 中 Mira 基础宽度输入从 6.4 改为 7.4，共享 0.9 系数不变，实际场景宽度 **5.76% → 6.66%**。站姿画布从 **401×911 → 411×911**，额外宽度用于完整容纳新轮廓；可见高度和脚底基线不变，因此同一透视下可见身高约增加 **12.8%**。行走图仍各 **2048×768**，每帧 **512×768**，沿用现有底边中心登记与透视插值。

生成母版、完整提示词、逐帧裁切与导出说明见 `art-source/mira-stage-4-2d-1/README.md`。测试页中将 Kai 移到 shelf，再选择 Mira，可直接对照两人在场景尺度下的比例与风格。160 项 Node 测试、434 项浏览器回归、生产构建通过，浏览器无 error/warning；验证覆盖脚底对齐、四方向播放和既有交互。本轮未提交、打 tag 或推送。生成帧的裙摆、发尾和背包仍可能有细微轮廓差异，最终美术认可需人工目视验收。

### Stage 4.2E-0 — Kai Counter Occlusion Fix

柜台处的空隙来自旧前景遮罩：它用一条过高的宽泛斜线覆盖了柜台后的背景，将 Kai 的身体提前截断。问题不在精灵脚底、缩放或路径锚点。`src/data/counterOcclusion.js` 现在按原始 1536×1024 场景中的台面、两台收银设备和柜台商品陈列轮廓登记遮罩，再转为百分比，仍由同一张未修改的 clean scene 充当前景。柜台后方层级 1、前景层级 2 和出口后的层级切换均保持原样。

开发页 `/tests/movement.html` 初始就是 counter；使用 **coffee_station / counter / shelf** 可检查柜台内移动及进出。现有 **Show route debug** 同时显示淡红色柜台遮罩轮廓，便于确认没有覆盖台面后方的空气；正常页面不会出现这条调试轮廓。

本轮未改场景/角色 PNG、任何角色的尺寸、脚底锚点、路线节点/连接、移动速度/时序、对话或 ambient 行为。Cat 行走尚未开始。新增回归检查真实前景/后方空隙采样点、柜台双向移动层级、背景与前景同框对齐和点击穿透。163 项 Node 测试、445 项浏览器检查及生产构建通过；初始柜台、咖啡台和进出柜台段完成目视检查，Console 无 error/warning。

### Stage 4.2E-0B — Counter Foreground Occlusion Layer

E-0 的静态轮廓修正并不足够。后续录像和连续帧检查发现：前景仍放在 NPC 的同一局部层级中，Kai 到达出口后会整体越过它，但伸出的脚仍与柜台侧面重叠。另外小刷卡机旁的遮罩折线错误地漏掉了一块实心台面。这一轮分别修正合成顺序、台面几何和出口净空。

- `SceneForeground.jsx` 将原 clean scene 作为独立前景，位于整个 `.npc-overlay` 之外。顺序为背景 → NPC stacking context（5）→ 柜台 foreground（6）→ vignette / HUD / DialoguePanel。角色局部深度改变无法绕过前景，遮挡不再在出口切换时突然失效。前景始终 `pointer-events: none`。
- `counterOcclusion.js` 保存原图 **1536×1024** 坐标的非矩形多边形；转换为百分比 clip-path，与背景共用同一个 scene box，不使用 viewport 像素。轮廓跟随台面后沿、收银机屏幕、陈列牌、出口右侧壁和前面板，右边界为 **x=730**。刷卡机位于台面内部，台面边线由 `(410,445) → (442,438) → (535,410)` 连续经过，不再向前缘凹入；完整顶点见该配置文件。所有显示像素直接来自原图，没有生成、重绘或修改任何 PNG。
- 唯一 waypoint 修正：`counter_exit` **(49.5%,45.5%) → (51.5%,45.5%)**，向右 30.72 art px。以现有 Kai 最宽行走帧的可见轮廓核算，左缘在出口处已越过 x=730。counter / coffee_station / counter_lane / shelf 坐标和路线图连接均不变；速度、帧率和时长计算方式不变。
- 开发页仍为 `/tests/movement.html`，`Show route debug` 可显示真实遮罩。检查顺序为 counter → coffee_station → counter → shelf → counter，调试图层不会进入正常页面或生产入口。

`tests/counter-frames.browser.jsx` 使用真实场景和路由，按 60 Hz 位置采样检查脚底与遮挡，并临时开启前景 hit-testing 来探测浏览器实际 clip-path / paint order；测试结束卸载，不影响生产点击。新增实心台面缺口、出口最宽姿势净空、前景独立 stacking context 和响应式配准回归。连续画面另作人工视觉复核；自动测试不能替代像素美术验收。

验证结果：164 项 Node 测试通过；390×844 与 1280×800 浏览器各 509 项检查通过，Console 无 error/warning；生产构建通过（复用项目 Vite 配置，验证时禁用本地环境文件加载）。另采集并逐张检查上述完整往返路线的 37 张连续画面，确认台面缺口和出口整体跳层已消除。所有背景与 NPC PNG 的校验值未变。

本方案针对当前已批准路线：所有角色与柜台相交的路径都位于柜台后侧，公共通道从柜台右边绕出。它不是通用 3D 深度系统；未来若新增从柜台正前方经过的路线，需要相应拆分遮挡区域。现有 Kai / Mira 精灵、基础尺寸、脚底登记、对话、ambient 和 OpenRouter 保持不变。Cat 行走未开始。本轮不 commit、tag 或 push。

### Stage 4.2E-0C — Counter Edge Occlusion Refinement

本轮只细调 `counterOcclusion.js` 的边线。对照原图放大检查后，发现长台面遮罩的直线仍位于亮边内侧，约漏出 3–8 art px 的边缘；出口右侧轮廓也缺少少量覆盖。保留既有独立前景和整个移动系统，改为沿台面外缘的分段顶点 `(410,441) → (415,439) → (440,431) → (465,423) → (490,415) → (515,408) → (535,401)`，包含暗色描边及约 1 art px 抗裁切抗锯齿余量。出口侧边从 x=730 修正到 x=732，在 y=416/438/470/493 登记边线，底部仍回到 (730,496)。所有坐标继续由原图转换为百分比。

没有修改 waypoint、anchor、切换阈值、素材或角色尺寸。增加亮边采样点与外侧空隙保护测试；真实浏览器逐帧检查增加 counter ↔ window 和重复 counter ↔ shelf，以及边线上实际 clip-path 命中检查。165 项 Node 测试、637 项浏览器检查、生产构建通过；另检查咖啡台往返、开放区往返、窗边路线及重复出口过程的 100 张连续画面。柜台仍是针对当前固定场景标定的二维遮罩，未扩展其他家具遮挡或 Cat 移动；没有 commit、tag 或 push。

### Stage 4.2E — Cat Movement Integration

Cat 现在复用 `useNpcMovement`、现有 waypoint 图、逐段路线与 latest-target-wins 中断处理。活动仍为 sleeping / grooming → floor、watching_door → door、wandering → aisle；同地点只切换姿态，不制造移动。整条路线保持 walking，到达后恢复当前活动姿态。活动调度、对话、关系状态及 API payload 没有改变，activity-aware dialogue 仍留给 Stage 4.5。

`src/data/catVisuals.js` 集中配置猫的四足素材与移动参数：125 art px/s、4 帧、8 FPS、125ms 到达整理；独立 224×192 画布统一底部中心着地。睡觉、梳毛、看门及站立使用静态姿态，侧面/正面/背面使用各四帧行走图。素材来源和注册方法见 `public/assets/npcs/cat/README.md`。旧 Cat 图和所有 Kai/Mira 图保持不变；猫可见休息宽度仍为场景的 6.12%，透视在 .85–1.05 范围内变化。

路线从 cat_aisle → cat_floor → cat_shelf_corner → cat_front_lane → cat_outer_lane → cat_door 接入 door_lane，仅有一个与共享图的连接，不改变人形路线。校准 Cat 的 shelf_corner 为 (39.5%,65%)，新增前侧 (62%,87.5%) 与外侧 (70%,85%) 通道，从货架前方走向门口；floor/door/aisle 的原坐标保持。Kai 的柜台遮罩完全不变，Kai/Mira 的速度、比例及步态不变。

开发页面 `/tests/movement.html` 的 NPC selector 现在含 Cat，可立即触发 floor/sleeping、floor/grooming、door/watching_door、aisle/wandering、Next，并查看同一套路线调试。生产页面不显示这些控制。新增 Cat 路线、同地点、姿态、步态、透视锚点、中断和无 API 调用回归。193 项 Node 测试、730 项浏览器/runtime 检查与生产构建通过，Console 无 error/warning。

限制：货架仍是平面背景，狭窄通道没有独立货架前景遮罩，不能声称完整物理遮挡；四帧步态的接地、转向及最终动画真实感仍待后续 polish。没有新增寻路引擎、物理或依赖，没有进入 Stage 4.3。

### Stage 4.2E — Shelf Occlusion Correction

人工验收发现 grooming/floor ↔ watching_door/door 路线上，近景货架的标牌和商品没有前景层，Cat 会盖在它们上面。新增 `src/data/shelfOcclusion.js`，沿原图近景商品架的包装顶部、斜标牌、纸盒阶梯、端头瓶盖及货架外沿描边（1536×1024 坐标，约 x=492–923、y=645–1024）。通过既有 `SceneForeground` 注册第二个 `merchandise-shelf` 裁剪层，复用原始背景像素，与场景严格同框；不使用矩形、不生成或修改 PNG、不覆盖后方中央货架及通道地面。

本修正不改路线、waypoint、Cat 的活动/尺度/锚点/速度/动画，也不改 Kai/Mira 或已验收的柜台遮罩。开发页继续选择 Cat 后点击 floor/grooming → door/watching_door → floor/grooming 即可重放；Show route debug 额外显示蓝色货架轮廓，仅开发页可见。

新增 Node 几何覆盖/留空及路线保护测试；浏览器在 900/390px 场景宽度下，对双向整条路线采样 60Hz 的实际 CSS 遮罩、绘制顺序和脚底位置。197 项 Node 测试、793 项浏览器/runtime 检查及生产构建通过；另录取正向 82、反向 85 张连续画面，检查入口、中段与出口，Console 无 error/warning。Kai/Mira 移动、Cat 动画与柜台回归保持通过。

限制：本遮罩只针对当前近景货架和已标定通道，不是通用三维深度/碰撞系统；其他未分层家具仍是平面图。没有进入 Stage 4.3，没有 commit、tag 或 push。

### Stage 4.3 — Ambient Activity Director

`src/game/ambientDirector.js` 现在统一决定何时、由谁切换活动，取代 Stage 4.1 的三个独立固定 interval。`useNpcActivities` 继续持有活动状态；App 将既有 NPC movement observer 接到 Director，移动实现、路线、精灵、遮挡和对话保持原样。

- 场景就绪后首次随机等待 **8–14 秒**；之后在角色到达且 settling 结束后重新随机等待 **16–28 秒**。全场最多一个 timeout，不补发积压事件。
- 活动派发前立即保留一个事件，直到对应目的地收到 idle 确认为止。任一角色 walking / settling 时均不安排新事件；旧目的地的 idle 回报不能提前释放保留事件。同地点活动和 reduced motion 可直接以 idle 完成。
- 不连续选择同一 NPC；最近两个事件中的其他角色权重为 **0.35**，其余为 **1**。这是按事件冷却的加权随机，不是强制轮班。
- 排除当前活动，沿既有 waypoint route 累加原图像素距离：**≤400px 权重4、≤900px 权重2、>900px 权重0.5**。原地切换归入短距离；长路线仍可选，但概率较低。活动→地点映射完全不变。
- 状态仅在 React 会话内存在。没有新增 UI、素材、依赖、持久化或 API 数据；活动专属美术留给 Stage 4.4，活动感知对话留给 Stage 4.5。

验证：`node --test tests/*.test.js` **202 项通过**；`/tests/runtime.browser.html` **796 项通过**，包括真实移动期间阻塞、到达后恢复、Mira/Cat 原地切换、Strict Mode/卸载清理，以及 Kai/Mira/Cat 移动、柜台/货架遮挡和原有对话回归。Browser Console 无 error/warning，`npm run build` 通过。

验收自动调度请打开正常首页；`/tests/movement.html` 仍是无自动调度的手动路线测试页。限制：这是简单的概率节奏控制，不保证每个短观察窗口内平均出场，也不保证完全杜绝连续的长距离行程；后台标签页可能受浏览器 timer 节流而延后。不新增动态避障、专属活动美术或活动感知对话。

### Stage 4.4 — Activity Visual Interaction

新增两张透明 RGBA 活动姿态图集（Kai 三格、Mira 四格），原有 idle / walking PNG 保持不变。完整生成提示词、来源与尺寸登记见 `public/assets/npcs/activities/README.md`；使用内置 image_gen，以现有 Kai/Mira 为风格和身份参考，没有下载第三方游戏素材或引入依赖。

| NPC | Activity | 到达后的视觉 |
| --- | --- | --- |
| Kai | behind_counter | 原有柜台 idle |
| Kai | making_coffee | 咖啡壶向杯中倒咖啡 |
| Kai | checking_shelf | 持纸盒、伸手整理商品 |
| Kai | looking_out_window | 侧后方看窗外 |
| Mira | reading_notes | 持笔在打开的笔记本上工作 |
| Mira | checking_phone | 低头查看手机 |
| Mira | choosing_drink | 举起饮料瓶查看 |
| Mira | staring_out_window | 背包朝向镜头、看窗外 |

`npcActivityVisuals.js` 集中管理映射与像素登记，`ActivitySprite.jsx` 裁剪单格；`WalkingSprite` 继续使用原有 idle 图片保留布局，只在非 walking 阶段显示当前活动姿态。行走和路线各段持续用现有行走帧，到达后直接切姿态，原地活动变化不触发假移动。每格按鞋底中心、可见身高登记到既有画布，不改 base scale、透视或 world anchor。未新增 working_on_paper 等活动；reading_notes 本身表达研究生工作状态。

手动验收：`/tests/movement.html` 选择 Kai/Mira，使用 **ACTIVITY POSES** 下方的四个按钮。保留原有目的地按钮与 Next，Cat 面板保持原样；整组调试控件固定在开发页底部并可滚动，不出现在生产页面。自动节奏仍使用 Stage 4.3 Director，未改任何调度配置或路线。

验证：207 项 Node 测试、880 项浏览器检查通过，生产构建通过，Console 无 error/warning。覆盖完整活动映射、PNG 尺寸/alpha、脚底和可见高度登记、每段行走隐藏活动图、到达显示、原地切换，以及既有 Director、Kai/Mira/Cat、柜台/货架遮挡和对话回归。

视觉限制：本轮是静态动作，不模拟真实拿取／摆放物品；手与机器、货架格位没有物理约束。新姿态的轮廓和头身观感仍可能与原 idle 有轻微差别，虽然脚底和可见高度已统一。没有活动循环动画，也没有把活动状态接入对话；Stage 4.5 未开始。未 commit、tag 或 push。

### Stage 4 Closeout — Activity Dialogue, Coherence & Cold Assets

当前请求为 `{ npc, message, history, activity? }`。活动定义集中于 `shared/npcActivities.js`，原 `src/data/npcActivities.js` 重导出同一份定义。API 校验活动是否属于对应 NPC；非法 id、对象、其他角色活动或自由文字返回 400。省略 activity 仍可用。`server/npc-activity-context.js` 仅用白名单 id 构造简短的服务端语义，不接收客户端提示词或坐标、路线、方向等渲染数据。角色可能正在走向活动目的地，提示词不擅自声称动作已完成。

OpenRouter messages：角色人格 → 固定 `server/scene-tone.js` → 可选活动上下文 → 当前 NPC history → 本次玩家消息。夜雨、凌晨 2:17、克制疲惫和细微善意始终存在，但不要求每句话复述天气或活动。Kai 始终话少、有干冷幽默；Mira 稍健谈、赶论文、疲惫而偶有自嘲。模型选择、512 token 上限、reasoning 关闭、超时和 fallback 行为不变。

按本轮设计调整，删除 Stage 3 的 state 容器、成功对话递增、hasMetPlayer、trust、familiarity 和 stranger/recognized/familiar 等级提示及其专属测试。mood/deadlineStress 的固定人格特征留在服务器角色说明，不作为可升级状态。`completeTurn` 只写入原有 per-NPC history；旧客户端额外传来的 npcState 被忽略，不进入模型上下文。没有新分数或长期记忆。

Director 在执行事件时排除当前对话角色，不重置已有随机等待，也不改变一场移动的互斥规则。切换/关闭对话后释放旧角色；没有对话面板时，Cat 的短暂反馈期间锁定 Cat。已经开始的路线继续完成，锁定只阻止新活动指派，避免引入移动中断系统。

**消失问题：** 修复前在本地生产构建、Cache-Control: no-store、活动/行走 PNG 延迟响应环境中复现：idle 图片已加载却 opacity=0，活动 PNG 尚无自然尺寸，导致角色空白。现在场景初始化预加载所有登记素材；`spriteAssets.js` 去重并等待 image.decode，保留解码后的 Image；`useLoadedSprite` 在目标素材就绪前保留最后可绘制描述（含姿态裁剪或行走方向），解码失败仍保留旧图。显示模式与逻辑 movement phase 分离，不暂停或改写路线，也不同时显示两套精灵。初次页面加载仍需等待初始 idle 图片；慢网下可能暂以旧姿态随锚点移动。

冷加载重放：先 `npm run build`，再 `node tests/cold-assets-server.mjs`，打开 `http://127.0.0.1:5187/`。这是服务 dist 的本地测试工具，不调用真实模型、不读取环境密钥（Stage 5 增加了本地模拟 API）；所有新姿态/行走素材延迟 12 秒且不缓存，首轮固定选择 Kai。修复后 14 秒期间每 500ms 采样一次，28 组样本中，初始图可用后的空白数和重复可见精灵数均为 0，覆盖 walking 时保留 idle 和到达后显示活动图。

本轮保留 movement/activity/occlusion 及 API fallback 回归，另测活动校验、服务端夜间基调与不递进、交互排除/释放、解码等待、过期加载和失败保留。189 项 Node 测试、851 项浏览器/runtime 检查通过，生产构建和 git diff --check 通过；Console 无 error/warning。测试调用模拟 OpenRouter，没有发起真实模型请求或部署。

仍有限制：模型遵循语气的效果仍需人工实聊验收；图像加载失败会继续显示旧姿态，刷新后重试；正在发生的移动不因打开对话而取消。步态真实感、美术和尺度微调留到 Final Polish，不在本轮处理。没有开始 Stage 5，没有 commit、tag 或 push。

### Stage 5 — Final Polish & Demo Readiness

本轮完成保守收尾，不重做美术、导航、调度或对话系统。

- 移动：2 art px 以内的端点余量直接对齐，不再为几乎看不见的位移播放 500ms 行走和 settling。真实路线、透视和脚底锚点不变；Kai/Mira 仍为 155 art px/s、Cat 为 125 art px/s，四帧 8 FPS 和周期取整不变。
- 冷素材切换：若到达后活动图尚未解码，保留的已加载行走图停在单帧，不会在 idle 阶段重新原地踏步。仍由解码状态控制唯一可见精灵，不添加交叉淡化或重复图层。
- 对话：长英文词/无空格回复自动换行，避免水平撑出面板。既有滚动、输入、关闭、失败重试、按角色隔离的 history 和交互锁保留。
- 清理：删除已经被解码可见性规则覆盖的旧 opacity/settling CSS 与未使用的 `--walk-settle` 属性。未删除历史参考素材，也未重新引入关系递进。
- 氛围与画面：检查现有 idle、步行、活动姿态和同地点切换，保留所有 PNG、比例、坐标、柜台/货架遮罩及 Director 的 8–14s / 16–28s 节奏。

验证命令与页面：

```sh
node --test tests/*.test.js
npm run build
git diff --check
# 开发回归：启动 Vite，打开 /tests/runtime.browser.html
npm run dev
# 另一个终端：本地生产构建 + 故障注入，绝不连接真实 OpenRouter
node tests/cold-assets-server.mjs
```

冷素材与完整流程测试页：`http://127.0.0.1:5187/__demo__/production.browser.html`。该独立页面在 iframe 中加载真正的 dist 构建，并通过本地 HTTP 请求调用原 API 校验器及模拟 provider。固定首轮 Kai，素材响应延迟 12s、Cache-Control: no-store；自动检查初始渲染、首次移动/活动、Loading、防重复、两轮 history、角色切换、一次失败后的重试、过期回复、猫反馈、刷新及 1280×720 / 1440×900 / 1024×768 视口。每次新一轮测试前重启该服务，以重置一次性失败记录。测试页与服务均不进入 dist，也不读取 .env.local。

结果：190 项 Node 测试、862 项浏览器/runtime 检查、27 项生产流程检查通过；生产测试每 100ms 采样，共 160 组，初始图可用后没有空白或重复精灵。已有 Kai/Mira/Cat、最新目标中断、活动视觉、Director、交互锁、活动对话、柜台/货架和 OpenRouter fallback 回归继续通过。生产构建与 git diff --check 通过；正常场景、移动页和 runtime 页 Console 无 error/warning，生产流程没有应用脚本错误或未处理 Promise。故障注入的 HTTP 500 是预期测试信号；iframe 验证期间浏览器工具注入层曾报 MutationObserver 错误，应用源码没有该调用。

演示限制：保留四帧步态，接地/转向不是物理模拟；极慢网络下可能暂以旧姿态移动，图片失败则保留旧图直到刷新。当前测试验证本地生产包和模拟上游，未验证线上 Vercel 或真实模型当天的可用性/回复质量。Stage 5 到此停止，未 commit、tag 或 push。

## 当前美术边界

背景仍是静态图，角色已分离为独立透明精灵，可按活动在锚点之间平滑移动；Kai 和 Mira 在移动中播放行走帧。动态来自 CSS 雨层、位置过渡和人形步态。极窄屏和非 3:2 窗口沿用基础取景；后续需继续校准落点、层级和遮挡。Kai 和 Mira 近似匀速，受四帧素材和周期取整影响，步幅与实际地面位移仍可能略有差异；两人沿手工通道绕行主要家具，但没有动态避障或方向对应的站立姿势。

### Pre–Stage 5 Living World — Finite Kai Tasks & Dialogue Portraits

本轮仅增加短任务完成时钟与左侧肖像，不启动 Living World。

`shared/npcActivities.js` 的 `finiteActivityDurations` 仅登记 Kai 的 `making_coffee` 和 `checking_shelf`，均为随机 **5000–10000ms**。`src/game/finiteActivities.js` 使用既有 movement observer，在对应目的地收到 idle（包括原有 settling 结束）后开始计时。计时独立于 Director；重复 idle 不重启计时，活动变化、重新移动和卸载会取消旧 timer，token 检查阻止过期回调和重复完成。Strict Mode 的 stop/start 也不会残留两个时钟。

完成状态独立于活动指派：保留原 activity→location 和原坐标，只让 Kai 显示原有 neutral/idle 图，不发起新活动、不走回柜台，也不改变环境事件的间隔或锁定。对话进行中仍可自然结束手头短任务，NPC 的交互锁保持；已完成的任务不再作为正在执行的 activity 发送给 API，省略该可选字段沿用现有兼容路径。看窗、Mira 的活动、Cat 睡觉等持续状态没有完成时钟。手动 movement harness 仍保持姿态，便于美术检查；实际 App 使用完成时钟。

肖像复用透明主图，不生成或改写 PNG，不放大网页中已经缩小的精灵：

| NPC | 来源 | 原图裁切区域（x, y, width, height） |
| --- | --- | --- |
| Kai | `/assets/npcs/kai.png` | 0, 32, 351, 600 |
| Mira | `/assets/npcs/mira/mira-idle.png` | 0, 22, 411, 585 |
| Cat | `/assets/npcs/cat/cat-watching.png` | 72, 0, 152, 155 |

`npcPortraits.js` 集中登记半身裁切，`CharacterPortrait.jsx` 保留 alpha 和像素渲染。场景初始化通过已有解码缓存预加载；普通切换直接显示正确角色，避免使用上一个角色的脸。首次网络尚未就绪时固定区域显示克制的省略号，不显示破图。桌面对话左列 96px，紧凑窗口 64px，窄屏 48px；右侧继续使用现有角色名、对话、选项和输入。Cat 保持原本的五秒本地反馈，只给反馈面板增加 52px 肖像和 THE CAT 标题，不引入模型输入或新的聊天行为。

新增测试覆盖任务时长范围、到达后起算、重复 idle、旧回调、A→B→A、停止清理、持久活动不超时、对话锁内完成、原地 neutral、完成后的 API 语义、透明图边界和即时肖像切换。未更改 OpenRouter provider、路线、角色比例或遮挡。

本轮验证：201 项 Node、885 项浏览器/runtime、34 项本地生产流程检查通过，build 与 git diff --check 通过。生产流程含 12 秒冷素材延迟、160 组可见性采样、三种桌面尺寸和 390×844 窄屏；普通页面 Console 无 error/warning。未调用真实 OpenRouter，未修改 provider。限制：完成后使用原有通用站姿，不新增地点专用 neutral 美术；首次极慢加载时肖像区域可能短暂显示省略号。当前工作树还包含此前未提交的 final-polish 改动；本轮不 commit/tag/push，不启动 Stage 5 Living World。

### Pre–Stage 5 — Counter Responsibility & Overheard Conversation

此节更新上面的短任务结束行为：现在结束后自动回柜台；玩家正与 Kai 对话时先在原地 neutral 等待，解锁后才开始返回。未启动 Stage 5 Living World。

- `ambientActivityChoices` 将 Kai 的日常选择限定为 behind_counter、making_coffee、checking_shelf。沿用 counter、coffee_station 和柜台右侧 shelf 三个既有位置；looking_out_window 仍是合法手动测试活动，但不再被 Ambient Director 自动选中。Mira/Cat 原有普通候选不变。
- 到达后的 5–10 秒短任务时钟保持。`counterCoherence.js` 收到完成通知后通过 Director 的轻量 reserve/release 接口取得移动互斥，再直接指派 behind_counter。返回不计入普通活动事件或冷却历史；其他移动进行中则等待，玩家交互中延后，新任务覆盖旧待返回请求。到达柜台后释放互斥，恢复正常随机间隔。
- 稀有交谈机会随机相隔 **90–180 秒**。Kai 必须在柜台、双方不在玩家对话中、所有角色已停止移动且没有待执行普通事件，才可开始；条件不合适就跳过，等待下一整个随机间隔，不排队追赶。
- Mira 使用仅社交事件选择的 `talking_to_kai`，位置 `counter_chat` 别名到现有 **counter_exit (51.5%,45.5%)**。没有新增 waypoint 或边，也没有更改已验收通道/遮罩。Mira 到达后才开始说话；Kai 始终在柜台。结束后 Mira 沿既有路线恢复先前活动，再释放普通调度。玩家介入立即结束旁听；如果正在与 Mira 对话，延后她的离开。
- `counterConversations.js` 包含三组本地短对话，每组 3–4 句，Mira/Kai 交替；排除上一组，避免连续复读。每句随机 **2.2–2.8 秒**，不进入玩家 history、不存储关系状态。此池现已作为下方动态交谈的失败/超时备用。
- `AmbientSpeechBubble.jsx` 作为角色同一移动实体的绝对定位子元素，始终在说话者上方，只有一个气泡，淡入、自动推进和清理。不中断玩家的底部 DialoguePanel，不拦截点击；原人物标签仅在其说话时暂时隐藏。

手动预览：启动 `npm run dev`，打开 `/tests/counter-preview.html`，点击 **Dev · Try counter conversation** 提前触发一次机会。该开发按钮只缩短本次等待，仍执行全部安全条件；若 Kai 正在任务中或玩家正在交谈则会跳过。这个页面不进入生产构建。也可在正常游戏保持不操作，等待真实的 90–180 秒机会。移动页仍能单独检查 Mira 的 counter_chat 及 Kai 的历史窗边路线。

新增回归覆盖柜台活动白名单、自动返回、锁定延后、新任务覆盖、其他移动互斥、稀有机会/跳过、Mira 到达门槛、台词轮换和回调清理、气泡锚定，以及正常调度恢复（动态升级后另验证单次社交 API 请求）。原有移动、姿态、肖像、活动对话、counter/shelf 遮挡和 OpenRouter fallback 检查继续保留。限制：使用现有柜台右侧停靠点和通用站姿，没有专门转身/对视美术；事件条件不满足时可能长时间没有交谈，这符合本轮稀有旁听定位。

本轮结果：221 项 Node 测试、934 项浏览器/runtime 检查、34 项本地生产流程检查通过，production build 和 git diff --check 通过。浏览器回归与实际旁听预览 Console 无 error/warning；另在正常场景检查了柜台气泡和角色停靠位置。生产流程仍使用本地模拟回复，没有调用真实模型或部署。保留此前未提交改动，本轮未 commit/tag/push，停止于 Pre–Stage 5。


### Pre–Stage 5 · 动态柜台交谈

有效事件开始、Mira 接近柜台时，`counterCoherence` 并行调用 `POST /api/social-chat`。仅发送 Kai 当前活动、Mira 当前/前一活动 ID；`server/social-handler.js` 校验并投影这些字段，忽略客户端额外指令。`server/social-dialogue.js` 复用服务器角色人格、场景氛围和 OpenRouter transport，一次生成完整交换，绝不逐句调用。

模型仍从服务器 `OPENROUTER_MODEL` 读取，默认 `openrouter/free`；reasoning 关闭、max_tokens 384、服务器超时 10 秒。为满足每事件一次生成，社交失败直接走精选台词，不额外尝试第二模型；玩家 `/api/chat` 的模型 fallback 完全保留。

共享结构校验器只接受 2–4 行、仅 Kai/Mira 且双方都有台词、每行最多 64 字的非空纯文本，去掉多余字段并拒绝明显分析标记。服务器失败只返回 `{fallback:true}`，不返回模型原文或异常详情。前端再次校验结果，映射到既有气泡格式。

Mira 到达时若生成已就绪则播放；仍在进行则自然停留最多 3 秒，宽限超时才播放精选交换并取消请求。玩家介入、事件退出或卸载均取消请求；事件身份与阶段校验保证迟到回复不会替换已经播放的台词。Mira 继续按既有规则恢复先前活动，正在与玩家交互时延后，不覆盖更新的状态。没有长期记忆或关系进度。

真实模型的文风与生成速度仍需人工验收；结构校验不能保证每句都符合语气。在较短接近路线或慢模型下，备用台词出现较多是有意的无等待行为。Node/browser 验证使用模拟生成，不消耗真实 API。

动态升级验证：229 项 Node 测试、939 项浏览器/runtime 检查、34 项生产流程检查通过；生产冷加载采样 160 次。build、git diff --check 通过。运行时测试 Console 无 error/warning；生产 iframe 工具注入曾报 MutationObserver warning/error，应用自身捕获的脚本错误和未处理 rejection 为零。此后升级为最多三段已播放生成内容的会话内防重复上下文，完全相同的回复仍视为不可用，不重试模型。不 commit/tag/push，未进入 Stage 5。


### Pre–Stage 5 · 社交生成可观测性与多样性

旧实现已通过确定性回归确认：到达柜台立即 abort 未完成请求，迟到的有效回复也被丢弃。现在仍提前生成，到达后给予 `COUNTER_SOCIAL.graceMs = 3000` 的无 UI 等待窗口，窗口内返回立即开始播放；已确认失败则到达后直接用备用，服务器请求上限仍为 10 秒。窗口结束标记 `grace_timeout`，与服务器 `timeout`、`invalid_output`、`generation_error`、前端 `network_error` 分开。不会无限等待，也不会迟到替换正在播放的句子。

社交专用采样为 temperature **0.95**、top_p **0.93**、max_tokens **384**，reasoning 关闭。支持 Kai 或 Mira 开头、2/3/4 行以及不固定交替的节奏。Prompt 扩大日常话题范围，不强制轮换；玩家 `/api/chat` 参数与 fallback 不变。

仅在当前页面内保存最近 3 段已开始播放的有效生成交换；下次附带 `recentExchanges`。服务器限制数量并重新校验每段，将它们作为不可信 user-context 数据，绝不拼进 system 指令。Prompt 明确避免相同话题、开头、包袱、结构和近似改写。语义防重复依赖模型，客户端另拒绝完全相同的近期交换。无数据库、关系或长期记忆。

`/api/social-chat` 返回不可见的 `source: llm | fallback`，失败带有限枚举 reason。真正播放来源由控制器记录，包含客户端超时和重复内容降级。DEV-only `tests/counter-preview.html` 显示 SOURCE、原因、耗时及最近 10 次完整交换。角色返回后可再次点击触发，不必等 90–180 秒；忙碌条件仍保留。生产构建没有调试面板和调试事件，正常社交间隔未改。

本轮真实服务端采样 3 次：1 次 LLM（1326ms），1 次 invalid_output（5183ms），1 次 generation_error（606ms）。这是服务器调用样本，不是浏览器完整链路成功率，也不能代表历史 fallback 比例。当前 Vercel 本地服务需要恢复登录，尚未在真实后端完成连续 5–10 次浏览器语气验收。Node 原生加载环境供服务器使用，未输出密钥；没有修改模型或部署。

本轮最终验证：232 项 Node、958 项浏览器/runtime、34 项生产流程检查通过，冷素材采样 160 次正常；build 与 git diff --check 通过。第一次浏览器全量运行在既有 Kai 路由计时检查上失败，未改移动代码，完整复跑通过，仍需留意此测试的计时敏感性。运行时 Console 无 error/warning。DEV 页实测能显示前端无 API 时的 `SOURCE: FALLBACK / http_error`；真实连续浏览器验收须先恢复 Vercel 本地服务。工作树保留，未 commit/tag/push，未启动 Stage 5。

### Pre–Stage 5 · Social pipeline reliability diagnostics (current behavior)

This section supersedes the arrival/grace timeout described above. Social generation starts during approach and has **one total budget from request start**, not a deadline relative to Mira's arrival. Server timeout is 45 seconds; the frontend watchdog is 50 seconds (including HTTP overhead). Arrival only enters an idle waiting phase. Responses received while approaching or waiting remain valid. Player interruption/unmount cancels the request and clears the watchdog; late replies cannot resurrect the event. No automatic retry or second model request was added.

Diagnosis with the existing local model `nvidia/nemotron-3-super-120b-a12b:free` confirmed valid key/environment loading, the correct OpenRouter endpoint, Bearer authorization and JSON content type. **HTTP 200 does not always mean generation success**: a captured body contained provider error code 503 and `Upstream error from Nvidia: Service temporarily overloaded`. The old player-oriented transport discarded this detail before the social handler mapped it to `generation_error`. A separate failure was trailing non-whitespace after a generated JSON object. The previous 3-second arrival grace also cancelled requests independently of the server's generation budget.

Social transport now lives in `server/social-transport.js`, keeping `server/openrouter.js` and player conversation behavior unchanged. The same endpoint/model/env/header contract is used. `response_format: {type:'json_object'}` requests JSON mode, as documented in [OpenRouter's parameter reference](https://openrouter.ai/docs/api_reference/parameters#response-format); the server still independently validates every response. Only a complete optional JSON code fence is unwrapped. Trailing prose, truncated JSON and invalid schemas are rejected rather than repaired or partially rendered. Sampling remains 0.95/0.93, max_tokens remains 384 and reasoning remains disabled. No creativity changes were made in this correction.

Fallback reasons distinguish `missing_api_key`, `network_error`, `openrouter_http_error`, `openrouter_provider_error`, `response_json_error`, `invalid_response`, `truncated_response`, `json_parse_error`, `schema_validation_error`, `timeout`, `request_cancelled` and unexpected `internal_error`. Production returns only source/reason/validated dialogue. Local development (`NODE_ENV=development`, or explicit `SOCIAL_CHAT_DEBUG=1` outside production) additionally returns a bounded diagnostic trace: request start/model, response HTTP status, provider code/message, content length/finish reason, schema completion or exact failure stage. Secrets/Bearer values are redacted; raw response bodies, reasoning and full provider metadata are never exposed. Debug flags cannot enable traces in a production environment.

The DEV counter preview now has both **Try counter conversation** and **Test social API only**. The latter isolates API generation without waiting for movement and has its own 50-second watchdog. Each attempt displays source, reason, detail, latency, trace and dialogue; pending attempts appear immediately. It retains the last 10 entries. Use `/tests/counter-preview.html` on the Vercel dev origin (normally port 3000); the Vite-only port intentionally reports `api_http_error` because it does not host Vercel functions.

Real server sample comparison (six requests each, small non-concurrent sample):

| Request version | Valid dialogue | Failure details |
| --- | --- | --- |
| Before | 4/6 (66.7%) | 1 JSON trailing-character parse failure; 1 HTTP-200/provider-503 overload |
| After | 3/6 (50%) | 3 HTTP-200/provider-503 overloads; no JSON/schema failures |

The samples **do not demonstrate an overall availability improvement**. They demonstrate precise overload diagnosis and successful JSON-mode requests. Free-provider availability still limits success; increasing timeouts cannot repair an immediate 503. Historical generic logs cannot retrospectively identify every earlier failure. No model switch/retry, UI redesign, movement/routing/scheduling change or Stage 5 work was introduced.

This correction changed only these social-pipeline files (the checkout also contains earlier uncommitted work):
- `server/social-transport.js` (new), `server/social-dialogue.js`, `server/social-handler.js`
- `shared/socialTiming.js` (new), `shared/socialDialogue.js`
- `src/lib/socialChat.js`, `src/game/counterCoherence.js`, `src/data/counterConversations.js`
- `tests/counter-preview.jsx`, `tests/counter-coherence.test.js`, `tests/counter-social.browser.jsx`, `tests/social-dialogue.test.js`, `tests/social-transport.test.js` (new)
- `README.md`

No edits to player `server/openrouter.js`, NPC movement, ambient event cadence, scene assets or dialogue panel were made in this correction. Existing unrelated working-tree changes remain intact.

Final verification for this correction: **237 Node tests**, **958 browser/runtime checks**, **34 production-flow checks**, and **160 cold-load visibility samples** passed. Production build and `git diff --check` passed. Runtime test Console had no error/warning. Browser/provider regression fixtures use mocked replies; the twelve real server requests above are reported separately. `.env.local` remains ignored. No commit/tag/push or Stage 5 work.

### Social dialogue quality pass

Social generation now uses a focused, server-owned Kai/Mira context instead of reusing player-addressed personality text. Their static relationship is familiar acquaintances, not close friends; this is fictional background, not a progression system. Kai is quiet and gentle, notices concrete details and offers indirect practical care without generic encouragement. Mira is quiet, independent and a little distant, with occasional specific low-key complaints about writing/research. The prompt favors short break-time exchanges, ordinary phrasing and varied conversational rhythms over poetic metaphors, forced punchlines or intimacy.

The existing session-local last-three-generated-exchange buffer is unchanged. `recentSocialTopics` derives bounded topic occurrence counts on the server (coffee/drinks, rain/weather, paper/research/revision, staying up late) and adds them only to the untrusted user-context section. The prompt discourages revisiting these recent subjects, openings and emotional endings; it does not mechanically cycle through topics. Full recent lines continue to help avoid repeats outside these four broad heuristics. No database, permanent memory, relationship level or extra model request was added.

Transport, timeouts, JSON mode/schema, curated fallback, model, temperature 0.95/top_p 0.93 and player conversation prompts remain unchanged. This pass modifies only `server/social-dialogue.js`, `tests/social-dialogue.test.js` and this README.

Final-prompt real server validation: 2/3 requests returned `source: llm`, 1/3 returned `source: fallback` with `openrouter_provider_error`. Outputs are not guaranteed to be polished: occasional awkward wording/typos and semantic repetition remain possible with the current model. Initial qualitative samples prompted stronger constraints against invented special facilities and abstract poetic imagery; no output is silently rewritten. The recent-topic matcher is deliberately heuristic, not semantic memory.

Quality-pass verification: 238 Node tests and 958 browser/runtime checks passed; browser Console had no error/warning. Production build and `git diff --check` passed. No commit/tag/push.
