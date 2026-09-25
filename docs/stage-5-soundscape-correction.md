# Stage 5 Soundscape Correction

This is a focused correction of the existing Stage 5 implementation. No scene, movement, Director, social/player provider, model configuration, or fallback behavior was changed in this pass. Prior Stage 5 changes remain uncommitted.

## Changes

- Removed the refrigerator event from the shared whitelist, server context, reaction candidates, bark pool, preview controls, and active documentation. The old ID appears only in negative regression tests (API rejects it with 400).
- Removed both persistent indoor sources: filtered noise and the 60 Hz oscillator. Removed procedural white-noise rain.
- Added `public/assets/audio/rain-loop.mp3` and its source/license/processing README. Source: Ove Melaa, CC0, https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available . Local 30-second, 481,114-byte recording loop with a 2-second crossfade; served locally, no runtime third-party request.
- Kept the Web Audio controller and trusted gesture hook. After unlock, fetch → decodeAudioData → one looping AudioBufferSource. Master fade, mute, current event state and context suspension recovery remain. Load failure/15-second deadline disables audio safely; disposal aborts download and stops/disconnects/closes resources.
- Rain gains (before master): softened **0.22**, baseline **0.4**, intensified **0.7**. Master **0.65**, effective gains **0.143 / 0.26 / 0.455**. Weather transitions **3s**, entry **2s**, mute/unmute **0.2s**. Absolute targets, no gain stacking. quiet_lull/expiry restores baseline.
- Door: original **720 Hz** sine, peak **0.16** before master, **0.104** after master, 40ms attack, fade by 650ms, stop at 700ms. Single-flight guard, cleanup on completion; no cue while muted/locked/suspended, no missed-event replay.
- Four events remain: `rain_intensifies`, `rain_softens`, `door_noise`, `quiet_lull`. Existing 45–90s opportunities, 30s semantic TTL, probabilities/reservations/locks remain unchanged.
- Preview includes rain state and only four buttons.

## Files touched by this correction

- `src/audio/soundscape.js`
- `shared/worldEvents.js`
- `src/data/worldEventReactions.js`
- `server/world-event-context.js`
- `tests/soundscape.test.js`, `tests/world-reactions.test.js`, `tests/chat.test.js`
- `tests/world-events.browser.jsx`, `tests/world-preview.jsx`
- `tests/cold-assets-server.mjs`, `tests/production.browser.js` (MP3 MIME and API-only request instrumentation)
- `public/assets/audio/rain-loop.mp3`, `public/assets/audio/README.md`
- `README.md`, Stage 5 design/plan/implementation report, this report

## Validation

- Node: 265 passing, including recorded-loop topology, three absolute gains, muted weather state, no continuous oscillator, single-flight door, missed events, HTTP/decode failure, timeout, disposal and suspension recovery.
- Browser/runtime: 977 passing, including movement, counter/shelf occlusion, finite activities, return-to-counter, interaction locks, dialogue/history, social behavior/fallback, portraits and sprite readiness.
- Production workflow: 41 checks / 160 cold-load visibility samples. Local HTTP fake providers are used; this is not a live OpenRouter quality/availability test.
- Build and git diff --check pass.
- Real browser preview: trusted click enters running with decoded asset; rain state buttons, mute/unmute and quiet_lull baseline checked. Normal production page console and preview console showed no errors/warnings.

## Listening acceptance still required

Automated checks and measured headroom do not certify subjective sound quality. No claim of physical headphone/speaker listening is made. Please verify recognizable calm rain without distracting music/voices/thunder, baseline loudness, clearly distinct three weather states, a several-minute loop without obvious restart, restrained audible door, and quiet late-night mood. Browser/OS output volume and MP3 decoder seam handling can vary.

Preview: http://127.0.0.1:5176/tests/world-preview.html . Click once to unlock. API interactions still require the existing Vercel backend; sound testing does not.

Branch: `feat/stage-5-living-world`; working tree intentionally dirty with prior Stage 5 work plus this correction. No commit, tag, push or merge.
