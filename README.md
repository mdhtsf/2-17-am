<h1 align="center">2:17 AM</h1>
<p align="center"><em>Somewhere, someone is still awake.</em></p>
<p align="center">A small AI-driven interactive world inside a convenience store on a rainy night.</p>
<p align="center">
  <img src="https://img.shields.io/badge/release-v1.0.0-d6b58c?style=flat-square" alt="Release v1.0.0">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React 19">
  <img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square" alt="Vite 7">
  <img src="https://img.shields.io/badge/AI-OpenRouter-777777?style=flat-square" alt="AI via OpenRouter">
  <img src="https://img.shields.io/badge/hosting-Vercel-222222?style=flat-square" alt="Vercel hosting">
</p>
<p align="center"><a href="#english">English</a> · <a href="#简体中文">简体中文</a></p>

<!-- Preview slot: add an actual final application screenshot here when available.
     Show the store, HUD, independent NPCs, and one open dialogue panel.
     The scene backgrounds in public/assets/scenes are artwork, not UI screenshots. -->

## English

[Overview](#overview) · [AI Architecture](#ai-architecture) · [Getting Started](#getting-started) · [Testing](#testing) · [简体中文](#简体中文)

### Overview

It is 2:17 AM. Rain gathers against the windows. Kai is working the night shift, Mira is still trying to finish her writing, and the cat has its own priorities.

**2:17 AM** is an independent interactive world built around this one place. Talk to its inhabitants, watch them move between familiar corners of the store, or leave the conversation and listen to the rain. Activities, dialogue, space, and atmosphere share the same setting.

Kai and Mira have distinct AI character identities and separate conversation context. Their language can reflect what they are doing and what has recently happened nearby. The world also continues without player input: short tasks end, ambient events occur, and the two humans occasionally exchange a few words.

### Highlights

- **Situated dialogue.** Server-side character prompts combine personality with validated activity and recent world-event context.
- **A paced living world.** A central director spaces out activity changes, with interaction locks and finite task durations.
- **Spatial characters.** Independent sprites follow authored waypoint routes, with walking poses, perspective scaling, and foreground occlusion.
- **Ambient conversations.** Kai and Mira occasionally exchange generated lines, with curated local dialogue when generation fails.
- **Separate conversations.** Each human NPC keeps its own session history; the cat remains a local environmental character.
- **A quiet presentation.** Pixel art, portraits, rain, sparse sound cues, and restrained dialogue UI hold the scene together.

### Experience

Click Kai or Mira to open a portrait dialogue panel. Type a message and press Enter, or choose a fixed response. Replies are primarily in Chinese; English carries the HUD and atmosphere. Kai speaks briefly and shows care indirectly. Mira is tired, restrained, and occasionally self-deprecating.

Click another character to switch conversations. Close the panel with Escape or the close button. The selected NPC is protected from ambient reassignment while you talk; other eligible characters can continue their routines. Click the cat for a brief local response.

Stay a while to see activities, changing rain, and occasional social exchanges. Sound starts after a browser-permitted user gesture and can be muted from the HUD. Character hotspots also support keyboard focus and activation.

### AI Architecture

AI generates language. Local JavaScript controls movement, scheduling, activity lifecycles, and interaction rules.

**Player dialogue:** the panel posts to `/api/chat`. The server validates the NPC, message, alternating history, and optional semantic context; builds character and scene instructions; then requests and validates an OpenRouter reply.

- Full character prompts, model selection, and credentials stay server-side.
- Clients send activity/event IDs, not arbitrary prompt text or rendering coordinates.
- Each NPC retains up to 20 history messages in React memory. Refreshing clears them.
- Reasoning output is disabled and never intentionally presented as dialogue.
- An optional secondary model is tried once for classified transient player-dialogue failures, within the server's shared time budget.
- A shorter UI deadline provides an in-character local reply when needed. Late responses cannot overwrite it; failed turns do not enter conversation history.

**Social dialogue:** a local social event calls `/api/social-chat`. Server-owned context includes the participants' activities and a short buffer of recent exchanges. OpenRouter returns structured dialogue; the server validates 2–4 short lines for the correct speakers before bubbles play in the scene.

Social generation uses the configured primary model. Its safety net is curated local dialogue, rather than the player endpoint's optional model retry. Generation has a bounded wait independent of character arrival. Recent exchanges help discourage repeated topics without creating permanent memory or friendship progression.

### Living World

The Ambient Activity Director selects one major activity change at a time. Its first opportunity is after 8–14 seconds; later opportunities use randomized 16–28 second delays. Selection discourages consecutive turns for the same NPC and favors shorter routes. Travel, reservations, and active interactions gate eligibility.

Activities determine destinations and arrival poses. Kai's coffee-making and shelf-checking tasks complete 5–10 seconds after arrival, release their task pose, and coordinate a safe return to the counter. Persistent activities, such as watching the rain or sleeping, are not automatically timed out.

Scene anchors and an authored waypoint graph guide movement. Walking frames remain active until arrival; bottom-center anchoring, perspective scale, depth ordering, and counter/shelf foreground masks keep sprites grounded. Same-location activities can change pose without unnecessary walking.

Separate local world events vary the rain and permit restrained reactions. The cat has small, occasional gestures. Social events reserve their participants and yield to player interaction. Required sprite assets are preloaded, and the current drawable sprite is retained until its replacement has decoded.

The soundscape combines a local rain recording, sparse window-drop details, a door cue, and occasional cat sounds. Audio provenance and licenses are documented in [the audio asset notes](public/assets/audio/README.md).

### Tech Stack

| Layer | Technology |
| --- | --- |
| Interface | React 19, JavaScript, CSS |
| Build | Vite 7 |
| World runtime | DOM sprites, local JavaScript controllers |
| Audio | Web Audio API, local recordings |
| Language generation | OpenRouter, native `fetch` |
| API / hosting | Vercel Functions / Vercel |

### Getting Started

#### Prerequisites and installation

Use Node.js **22.12+**. Vite also supports the Node 20 line from **20.19**. Full AI dialogue requires an OpenRouter API key and a Vercel account/project for local Functions development.

```sh
git clone https://github.com/mdhtsf/2-17-am.git
cd 2-17-am
npm install
```

#### Frontend development

```sh
npm run dev
```

Open the printed address, usually `http://localhost:5173`. The scene, movement, local activities, sound, and fixed interactions run here. Bare Vite does **not** serve `/api/chat` or `/api/social-chat`; generated dialogue requires the full local setup. Local fallbacks remain available.

#### Full local development

Create an ignored `.env.local` with placeholders replaced locally:

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
# Optional secondary model for player dialogue:
# OPENROUTER_FALLBACK_MODEL=your_optional_fallback_model
```

`OPENROUTER_MODEL` selects the primary model for both APIs; when unset, it defaults to `openrouter/free`. `OPENROUTER_FALLBACK_MODEL` is optional and has no implicit default. Keep all three server-side, without `VITE_` prefixes. Never commit credentials.

In Bash or Zsh, explicitly export the local values into the development process:

```sh
(
  set -a
  . ./.env.local
  set +a
  npx vercel dev --listen 3000
)
```

Complete Vercel CLI login/project-link prompts if required, then open `http://localhost:3000`. This runs the frontend and API routes locally; it does not deploy the project. Optional `SOCIAL_CHAT_DEBUG=1` enables sanitized social-generation diagnostics outside production.

#### Production build

```sh
npm run build
npm run preview
```

The build is written to `dist/`. Preview serves static output only, not Vercel Functions.

### Project Structure

```text
api/              Vercel request entrypoints
server/           Validation, character context, OpenRouter transports
shared/           Public NPC/activity definitions and API limits
src/
  components/     Scene layers, sprites, portraits, dialogue UI
  data/           Scene anchors, routes, visual and occlusion configuration
  game/           Ambient scheduling, tasks, world and social events
  hooks/          React integration, movement and asset readiness
  lib/            Client requests and shared browser utilities
public/           Scene, NPC and audio assets
tests/            Domain tests, browser checks and development harnesses
```

### Testing

```sh
node --test tests/*.test.js
npm run build
```

With Vite running, open `/tests/runtime.browser.html` for React/runtime regressions. Development harnesses include `/tests/movement.html`, `/tests/counter-preview.html`, and `/tests/world-preview.html` for movement, social conversations, and world events. Real social generation in the preview requires the Vercel API server.

For built-output and deliberately delayed asset checks:

```sh
node tests/cold-assets-server.mjs
```

Open `http://127.0.0.1:5187/__demo__/production.browser.html`. Restart this fixture before each run to reset injected failures. It serves the production build with simulated provider replies and cold sprite delays; it does not verify live OpenRouter availability.

Coverage includes request validation, provider failures, separate histories, scheduling, movement, occlusion, interrupted requests, and asset readiness. Live dialogue quality, visual seams, responsive composition, and sound balance still need manual review.

### Design Principles

- **AI belongs to the world.** Character language shares the scene's identity and relevant current context.
- **The world should not wait for AI.** Local behavior and fallbacks keep the experience running during slow or failed requests.
- **Behavior before complexity.** Explicit rules make pacing and interaction understandable.
- **Small world, complete loop.** One location supports observation, interaction, departure, and continued ambient life.

### Limitations

Context is session-local: there is no database, login, long-term memory, or relationship progression. Navigation uses authored routes, not general-purpose spatial reasoning or physics. Animation uses a limited set of frames and poses. Model availability, latency, and response quality depend on the selected OpenRouter provider; prompt length targets are guidance, not guaranteed character limits. Audio playback is subject to browser interaction policies.

### Release

**v1.0.0 — First Complete Release** completes **Prologue 01: The Night Shift**: the first full development cycle of this small interactive world.

[Read in 简体中文 ↓](#简体中文)

---

## 简体中文

[项目概览](#项目概览) · [ai-架构](#ai-架构) · [本地运行](#本地运行) · [测试与验证](#测试与验证) · [English](#english)

### 项目概览

凌晨 2:17，雨落在便利店的玻璃上。Kai 正在值夜班，Mira 还想把手头的文字写完，猫则有自己的打算。

**2:17 AM** 是一个发生在这家便利店里的独立 AI 互动世界。你可以与角色交谈，看他们在店内熟悉的角落之间走动，也可以结束对话，安静听雨。语言、活动、空间和氛围共同构成这个夜晚。

Kai 和 Mira 拥有各自的角色身份与会话上下文，可以结合当前活动和近期环境事件作答。即使玩家没有操作，世界也会继续：短暂的工作会结束，环境会变化，两位角色偶尔会自然交谈几句。

### 核心特点

- **有情境的角色对话。** 服务端将人物性格与经过校验的活动、环境事件结合。
- **有节奏的日常活动。** 集中调度器协调活动切换、互动锁和短任务持续时间。
- **存在于空间中的角色。** 独立精灵沿预设路线移动，具备步行动画、透视缩放和前景遮挡。
- **偶发的角色交流。** Kai 和 Mira 使用生成式短对话；生成失败时使用本地备用台词。
- **彼此独立的会话。** 两位人物分别保存当前会话历史；猫保持轻量的本地环境角色定位。
- **克制的呈现。** 像素场景、立绘、雨声、稀疏音效和对话界面共同维持深夜氛围。

### 如何体验

点击 Kai 或 Mira，打开带人物立绘的对话面板。输入文字后按 Enter 发送，也可以选择固定回应。中文负责对话内容，英文用于 HUD 与氛围。Kai 话少，关心往往不直接表达；Mira 疲惫、克制，偶尔轻微自嘲。

点击另一位角色即可切换会话，按 Escape 或关闭按钮退出。交谈中的角色不会被环境调度器重新分配活动，其他符合条件的角色仍可继续行动。点击猫会得到简短的本地反馈。

停留一会儿，可以观察日常活动、雨势变化和偶发交流。声音在浏览器允许的用户操作后启动，可通过 HUD 静音。角色热区也支持键盘聚焦与激活。

### AI 架构

AI 负责生成语言；移动、调度、活动生命周期和互动规则由本地 JavaScript 控制。

**玩家对话：** 面板向 `/api/chat` 发送请求。服务端校验角色、消息、交替排列的历史记录及可选语义上下文，组织人物与场景指令，再请求 OpenRouter 并校验回复。

- 完整角色提示词、模型选择和凭据只保留在服务端。
- 客户端发送活动和事件 ID，不发送任意提示词或渲染坐标。
- 每位人物在 React 内存中分别保留最多 20 条历史消息，刷新后清空。
- 请求关闭 reasoning，不将推理内容作为对话展示。
- 玩家对话可配置备用模型；仅针对明确归类的临时故障，在共享超时预算内尝试一次。
- 界面采用更短的等待期限，必要时显示符合角色身份的本地回复。迟到结果不会覆盖它，失败轮次不写入会话历史。

**角色间对话：** 本地社交事件调用 `/api/social-chat`。服务端上下文包含双方活动和少量近期交流记录，要求 OpenRouter 返回结构化台词；校验发言角色及 2–4 条短句后，再在场景中依次展示。

社交生成使用配置的主模型，失败保障是本地备用台词，不沿用玩家接口的备用模型重试。生成等待有上限，且不因角色先到达就立即降级。近期交流用于减少话题重复，不构成永久记忆或友情成长系统。

### 世界如何运转

Ambient Activity Director 每次只发起一个主要活动变化。首次机会在 8–14 秒后，之后使用随机的 16–28 秒间隔。选择时尽量避免连续选中同一角色，并偏好较短路线；移动、事件预约和玩家互动共同限制角色是否可被调度。

活动决定目的地与到达后的姿态。Kai 制作咖啡、检查货架的任务在到达后持续 5–10 秒，完成后结束任务姿态，并在安全条件下协调返回柜台。看雨、睡觉等持续状态不会自动计时结束。

场景锚点与预设路点图控制移动。角色到达前保持步行动画；脚底居中锚定、透视缩放、深度排序及柜台/货架前景遮罩共同维持空间关系。同地点的活动变化可以直接切换姿态，无需假走一段路。

独立的本地事件改变雨势，并允许克制的角色反应。猫偶尔有细小动作。社交事件预约参与者，并让位于玩家互动。所需精灵素材提前加载；新图完成解码前保留当前可绘制精灵，避免切换时消失。

声音由本地雨声录音、稀疏的玻璃雨滴、门口提示音与偶发猫叫组成。来源与授权见[音频素材说明](public/assets/audio/README.md)。

### 技术栈

| 层次 | 技术 |
| --- | --- |
| 界面 | React 19、JavaScript、CSS |
| 构建 | Vite 7 |
| 世界运行逻辑 | DOM 精灵、本地 JavaScript 控制器 |
| 声音 | Web Audio API、本地录音 |
| 语言生成 | OpenRouter、原生 `fetch` |
| API / 托管 | Vercel Functions / Vercel |

### 本地运行

#### 环境与安装

使用 **Node.js 22.12+**；Vite 同样支持 **20.19+ 的 Node 20 系列**。完整 AI 对话需要 OpenRouter API Key，以及用于本地 Functions 开发的 Vercel 账号和项目。

```sh
git clone https://github.com/mdhtsf/2-17-am.git
cd 2-17-am
npm install
```

#### 仅运行前端

```sh
npm run dev
```

打开终端给出的地址，通常为 `http://localhost:5173`。场景、移动、本地活动、声音与固定交互可运行。纯 Vite **不提供** `/api/chat` 和 `/api/social-chat`，真实生成需使用下方完整环境；本地备用回应仍可使用。

#### 同时运行前端与 API

创建被 Git 忽略的 `.env.local`，在本地替换占位值：

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
# 玩家对话可选的备用模型：
# OPENROUTER_FALLBACK_MODEL=your_optional_fallback_model
```

`OPENROUTER_MODEL` 为两个 API 选择主模型，未设置时默认 `openrouter/free`。`OPENROUTER_FALLBACK_MODEL` 可选，没有隐含默认值。这些变量只用于服务端，不要加 `VITE_` 前缀，也不要提交真实凭据。

在 Bash 或 Zsh 中，将本地变量显式传给开发进程：

```sh
(
  set -a
  . ./.env.local
  set +a
  npx vercel dev --listen 3000
)
```

按需完成 Vercel CLI 的登录与项目关联提示，打开 `http://localhost:3000`。该命令在本地提供前端与 API，不执行部署。非生产环境可选设 `SOCIAL_CHAT_DEBUG=1`，查看经过脱敏的社交生成诊断。

#### 生产构建

```sh
npm run build
npm run preview
```

产物位于 `dist/`。Preview 仅服务静态构建，不运行 Vercel Functions。

### 目录结构

```text
api/              Vercel 请求入口
server/           校验、角色上下文与 OpenRouter 通信
shared/           公开角色/活动定义及 API 限制
src/
  components/     场景叠层、精灵、立绘、对话界面
  data/           场景锚点、路线、视觉与遮挡配置
  game/           活动调度、任务、环境及社交事件
  hooks/          React 接入、移动与素材就绪状态
  lib/            客户端请求及浏览器工具
public/           场景、角色、音频素材
tests/            逻辑测试、浏览器检查与开发验收页面
```

### 测试与验证

```sh
node --test tests/*.test.js
npm run build
```

启动 Vite 后，打开 `/tests/runtime.browser.html` 运行 React/浏览器回归。开发验收入口包括 `/tests/movement.html`、`/tests/counter-preview.html`、`/tests/world-preview.html`，分别用于移动、角色交流及环境事件。交流页面的真实生成需要 Vercel API 服务。

验证构建产物与刻意延迟的素材加载：

```sh
node tests/cold-assets-server.mjs
```

打开 `http://127.0.0.1:5187/__demo__/production.browser.html`。每轮运行前重启测试服务，以重置故障注入记录。它使用生产构建、模拟回复与冷素材延迟，不能证明实时 OpenRouter 服务可用。

回归覆盖请求校验、上游故障、历史隔离、调度、移动、遮挡、请求中断和素材就绪。真实对话质量、遮挡边缘、不同尺寸下的构图与声音平衡仍需人工验收。

### 设计原则

- **AI 存在于世界中。** 角色语言与场景身份和当下情境保持联系。
- **世界不必等待 AI。** 生成缓慢或失败时，本地行为与备用回应维持体验。
- **先把行为做清楚。** 用明确规则组织节奏与交互。
- **小世界，完整循环。** 在一个地点完成观察、交谈、离开与持续生活。

### 边界与限制

上下文只存在于当前会话中：没有数据库、账号、长期记忆或关系成长系统。移动基于预设路线，不具备通用空间推理或物理模拟；动画使用有限的帧与姿态。模型可用性、延迟和回复质量取决于所选 OpenRouter 提供方；提示词中的篇幅目标不是硬性字数保证。声音播放受浏览器用户交互策略限制。

### 版本

**v1.0.0 — First Complete Release** 是 **Prologue 01: The Night Shift** 的首个完整版本，标志着这个小型互动世界完成了第一轮完整开发。

[Back to English ↑](#english)
