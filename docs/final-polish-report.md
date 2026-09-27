# Final Polish — verification report

Date: 2026-09-27. Scope: the seven approved polish items plus the subsequently authorized Dialogue Brevity follow-up. Working branch: `main`. No commit, tag, push, merge or deployment. No new dependency; OpenRouter provider/model/fallback configuration, scene artwork, existing sprites, routes, movement, occlusion and Director timing remain unchanged.

## Implemented behavior

| Item | Final behavior |
| --- | --- |
| Rain | Soft/base/intensified gains **0.22 / 0.34 / 0.46**; master **0.65**; effective **0.143 / 0.221 / 0.299**. Existing rain recording and 3s fades preserved. |
| Window drops | Optional local CC0 rain-on-glass recording; **3–8s opportunities / 55% chance**, **0.32–0.55s** snippets with random offset and rate **0.95–1.05**. Gain caps **0.08 / 0.10 / 0.12**, multiplied by **0.75–1.0** then master. Sparse, single flight, mute/dispose safe. |
| Social presentation | Each eligible existing 90–180s opportunity randomly chooses **70% remote / 30% approach**. Remote retains current positions and activities, reserves the existing major-event gate and releases on completion/interruption. Approach uses existing walk/return. Both share the same generated dialogue and curated fallback. One prompt clause was neutralized so it no longer incorrectly says Mira always approached the counter. |
| Cat micro poses | New transparent 2-pose atlas referenced from the accepted cat. **60–100s opportunities / 50% chance**, equally choosing yawning/scratching when awake, idle and unblocked. Each lasts **2–4s**, then restores the appropriate activity pose. Movement, new activity, player interaction or recent world-event context cancels an active pose. Unsafe opportunities skip rather than queue. Opportunity clock survives ordinary changes, preventing starvation. No activity/route assignments or meow coupling. |
| Player long wait | **8s** without a usable reply releases loading, invalidates the request, aborts and selects one of **3 character-specific fallback lines**. Draft retained; failed turn and fallback excluded from history. Request identity guards late success/failure/finally paths so retry/new messages cannot be overwritten/unlocked by old responses. Immediate network/HTTP failures retain the existing natural retry UI. |
| Mira portrait | `flipX: true` on the existing cropped portrait container only; original PNG, crop, scale and dialogue layout unchanged. |
| Cat meow | Local CC0 recording (~**0.759s**, **10KB**), independent **20–40s opportunities / 35% chance**, gain **0.22** before master. One active meow maximum, no missed-cue replay, optional load failure isolated, timers/download/nodes cleaned on disposal. |

New media: `cat-micro-poses.png` (~624KB), `window-drops.mp3` (~97KB), `cat-meow.mp3` (~10KB). Audio sources/license/adaptations/hashes: `public/assets/audio/README.md`. Generated Cat reference and atlas registration: `public/assets/npcs/cat/MICRO-POSES.md`.

## Verification

- `node --test tests/*.test.js`: **283 passed, 0 failed**.
- `/tests/runtime.browser.html`: **1,041 checks passed**, including the existing Stage 4/5 movement, scheduling, world event, social generation/fallback, finite activity, occlusion, sprite readiness and dialogue tests.
- Cat micro standalone browser regression: **23 checks passed** (also included in the 1,041).
- Production workflow: **45 checks passed**, **160 cold sprite visibility samples**. Includes actual local HTTP with fake provider, 8s timeout, retry/new message, stale response, refreshed history and four viewport sizes.
- `npm run build`: passed, 85 modules. `git diff --check`: passed.
- Complete runtime, Cat preview, world/audio preview and independent built production homepage: inspected Console contained **no errors/warnings**. Actual browser gesture unlocked Web Audio; mute changed to muted and unmute restored running. Kai/Mira/Cat opening/click behavior checked on the built homepage.
- Production iframe automation log contained one existing `MutationObserver.observe` non-Node error. The test's application error/unhandled-rejection collector remained empty; it did not reproduce on the standalone production page. This is recorded as an environment/test-container limitation, not asserted to be proven harmless or fixed.
- No real OpenRouter requests were used for these regressions; fixtures use mock/fake replies. Live provider reliability and response quality have not been re-certified.

Two integration issues were caught and corrected: Cat micro timers initially restarted on every ordinary state change, starving real opportunities; and the old counter preview globally captured timers overlapping the new Cat cadence. The opportunity clock now persists, and the preview uses a specific DEV-only social trigger with the existing guards.

The production stress fixture intentionally delays every non-base sprite by 12s. That saturated HTTP/1 connections and made the new 8s dialogue deadline fire before a 1s fake provider request could start. Production tests now finish cold-asset stress before separately measuring API timing, including after refresh. Application timeout behavior was not weakened. Restart `node tests/cold-assets-server.mjs` before each rerun to reset the one-time injected API failure.

## Manual acceptance still required

1. Listen through several minutes on headphones/speakers: all three rain levels stay gentle; drops are recognizable but subtle; meow is natural and not too frequent. Numeric gains and automated tests cannot certify sound quality.
2. Inspect Cat yawning/scratching at normal scene scale and near the shelf/door: identity, pixel style, silhouette, apparent size and ground registration. Static poses intentionally have no elaborate transition animation.
3. Confirm Mira portrait direction and balance; observe remote/approach social pacing and interruption with the real backend. 70/30 is a probability, not a guaranteed small-sample quota.
4. Try slow live dialogue and retry: the 8s UI cutoff intentionally discards later replies, even if the provider eventually succeeds. Server/provider fallback behavior is unchanged.

With Vite at port 5176: `/tests/cat-micro.html` is the immediate pose preview; `/tests/world-preview.html` tests sound/world changes; `/tests/counter-preview.html` shows presentation/source diagnostics. Vite alone does not host API functions; live dialogue/social generation still requires the existing Vercel development backend. Production tests use port 5187 and fake replies.

## Changed files

The following working-tree entries were present at final reporting (all are uncommitted changes for this pass; `.env.local` remains ignored and untracked):

```text
 M README.md
 M public/assets/audio/README.md
 M server/social-dialogue.js
 M src/App.jsx
 M src/audio/soundscape.js
 M src/components/CatSprite.jsx
 M src/components/CharacterPortrait.jsx
 M src/components/ConvenienceStoreScene.jsx
 M src/components/DialoguePanel.jsx
 M src/components/NPC.jsx
 M src/data/counterConversations.js
 M src/data/npcPortraits.js
 M src/data/npcSpriteAssets.js
 M src/game/counterCoherence.js
 M src/hooks/useNpcActivities.js
 M src/styles.css
 M tests/cold-assets-server.mjs
 M tests/counter-coherence.test.js
 M tests/counter-preview.jsx
 M tests/counter-social.browser.jsx
 M tests/portraits.browser.jsx
 M tests/production.browser.js
 M tests/runtime.browser.jsx
 M tests/soundscape.test.js
 M tests/world-events.browser.jsx
?? public/assets/audio/cat-meow.mp3
?? public/assets/audio/window-drops.mp3
?? public/assets/npcs/cat/MICRO-POSES.md
?? public/assets/npcs/cat/cat-micro-poses.png
?? src/data/catMicroVisuals.js
?? src/data/dialogueFallbacks.js
?? src/game/catMicroBehaviors.js
?? src/hooks/useCatMicroBehavior.js
?? tests/cat-micro.browser.jsx
?? tests/cat-micro.html
?? tests/cat-micro.jsx
?? tests/cat-micro.test.js
?? tests/dialogue-polish.browser.jsx
?? tests/dialogue-polish.html
?? tests/dialogue-polish.jsx
```

Documentation additionally updated: `README.md` and this report. No Git history or remote changes.


## Follow-up: Dialogue Brevity

Changed `server/characters.js`, `server/scene-tone.js`, `shared/npcs.js`, `tests/openrouter.test.js`, README and this report. Kai now normally uses 1–2 short sentences; Mira 1–3. The player-only prompt targets 20–60 Chinese characters including punctuation, with rare 80–100 character contextual exceptions and no padding of short acknowledgements. It explicitly prioritizes one thought, implication and restrained speech over emotional exposition or self-description. Existing personality, activity, world-event context and conversation history remain present.

Both primary and fallback receive identical brevity instructions. The shared scene tone no longer contradicts the tighter sentence counts. Four fixed-choice replies were shortened to 11–25 characters and 1–2 sentences. Existing timeout fallback pools already contain 11–19 characters and 1–2 sentences; no change needed. Social JSON schema/per-line limit, model configuration, provider fallback, reasoning and max_tokens 512 remain unchanged. No runtime slicing or additional LLM call.

Validation: two new provider-boundary regressions first failed under the old prompt, then passed. **285/285 Node tests**, `npm run build` and `git diff --check` passed. The prior 1,041 browser / 45 production checks document the seven-item pass, not a rerun of this prompt/text-only follow-up. Real LLM brevity compliance has not been tested in this follow-up; manual live dialogue acceptance remains necessary. No commit/tag/push/deploy. Existing unrelated working-tree changes, including `.gitignore`, were preserved.
