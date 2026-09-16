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
{"npc":"mira","message":"你为什么这么晚还在这里？","history":[]}
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

## Stage 3.1：NPC State Foundation

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

## 当前美术边界

场景为静态生成图，角色不能独立呼吸或改变姿态；动态仅来自 CSS 雨层。后续可精修角色造型与研究生设定的一致性、招牌文字，以及将角色分离成与背景一致的透明素材。极窄屏和非 3:2 窗口采用基础取景，优先保证热区可用。
