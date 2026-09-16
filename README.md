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

## Stage 2.2A：OpenRouter Real LLM Integration

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

当前服务器端使用原生 fetch 调用 `https://openrouter.ai/api/v1/chat/completions`，模型固定为 `openrouter/free`。密钥仅从 `process.env.OPENROUTER_API_KEY` 读取；本地放在被 Git 忽略的 `.env.local` 中，不要使用 `VITE_` 前缀，也不要把密钥放入源码或提交到 Git。

messages 是合法 history 加上当前 `{ role: 'user', content: message }`，尚无 system prompt。只读取 `choices[0].message.content`，并转换为 `{ reply }`；不转发原始 JSON、reasoning 或上游错误详情。请求明确关闭 streaming、排除 reasoning 输出，并限制为 512 个输出 token。服务端超时 45 秒，前端等待上限 60 秒。缺少环境变量返回 503，网络/上游/回复格式错误返回 502，超时返回 504；错误结构仍为 `{ error }`。

Stage 2.2B 可在 `server/openrouter.js` 构造 messages 前，从服务端角色配置生成 system message（handler 已传入 npc）。当前有意不加入角色人格，也没有数据库或长期 Memory。参考 [OpenRouter API 文档](https://openrouter.ai/docs/quickstart) 与 [reasoning 输出控制](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)。

### 完整本地联调

需要 Vercel CLI；本轮未安装 CLI、登录、关联项目或部署。可以由开发者在项目目录运行：

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

预期返回 `{"reply":"模型生成的文本"}`。Kai / Mira 当前没有不同的角色 prompt，因此不保证回复风格有差异。在浏览器点击 Mira，发送“你好”，再发送“你还记得我刚才说了什么吗？”，随后测试 Kai 一轮，检查 Network 中的 POST 和第二轮 history。

### 已执行验证与边界

```sh
node --test tests/chat.test.js tests/openrouter.test.js
npm run build
```

- API 与 OpenRouter 边界单元测试：12 项通过，涵盖两轮 messages、角色校验、缺少密钥、网络失败、非 2xx、无效 JSON、无效 content、超时及敏感详情不外传。测试 mock fetch，不读取 `.env.local`、不调用真实模型。
- Stage 2.1 已执行的 `tests/dialogue.browser.js` 是供 Playwright `browser_run_code_unsafe` 执行的浏览器测试脚本，明确使用 HTTP mock。已验证输入、中文输入法、Loading、重复发送、两轮 history、角色隔离、错误重试、切换取消、猫反馈及桌面/窄屏面板边界。
- Stage 2.1 浏览器验证时，正常页面 Console 无 error / warning；错误路径测试主动模拟了 HTTP 500。本轮按确认范围仅完成代码和服务端测试，未重新验证浏览器 Console。
- Stage 1 主图、构图、热区位置、HUD 和雨层未修改；没有新增 npm 依赖。
- Stage 2.2A 已直接调用实际 API handler 并请求 OpenRouter：Mira 两轮、Kai 一轮均为 200；Mira 第二轮正确回忆“你好”。测试日志仅输出状态和最终回复，没有输出原始上游 JSON / reasoning。
- **Stage 2.2A 的浏览器 → Vercel Function → OpenRouter 完整联调仍待执行**。上述服务端真实测试及历史浏览器 HTTP mock 不能替代这一步。

## 当前美术边界

场景为静态生成图，角色不能独立呼吸或改变姿态；动态仅来自 CSS 雨层。后续可精修角色造型与研究生设定的一致性、招牌文字，以及将角色分离成与背景一致的透明素材。极窄屏和非 3:2 窗口采用基础取景，优先保证热区可用。
