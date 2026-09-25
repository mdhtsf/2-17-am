# Rain ambience

`rain-loop.mp3` — derived from **Ove Melaa – Rainy (NOT loopable)**.

- Author: Ove Melaa / OveMelaa.
- Source: https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available
- Original: https://opengameart.org/sites/default/files/Ove%20Melaa%20-%20Rainy%20%28NOT%20loopable%29.ogg
- License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), verified on source page 2026-09-25. Attribution not required; retained here voluntarily. This license applies to this audio, not to unrelated project assets.

Local adaptation: take seconds 15–47 of the original; high-pass at 90 Hz, low-pass at 6500 Hz, +20 dB to compensate for the very quiet source. Reorder the middle 28 seconds followed by a 2-second equal-power tail/head crossfade. The loop boundary then joins consecutive source samples. Encode stereo 44.1 kHz MP3 at 128 kbps, approximately 481 KB / 30 seconds. Browser decode removes encoder padding where supported; loop seams still require listening across browsers.

FFmpeg measured the encoded file at about -23 dBFS mean / -4 dBFS peak. These measurements check headroom, not subjective sound quality or absence of distracting sounds.

Controller gains: master 0.65; rain softened 0.22, baseline 0.4, intensified 0.7. Effective gains are 0.143 / 0.26 / 0.455. Expected baseline mean level is approximately -35 dBFS. Rain changes take 3 seconds; first unlock fades in over 2 seconds; mute/unmute over 0.2 seconds. Values are absolute, never compounded.

The door is an original 720 Hz sine cue, gain 0.16 before master (peak 0.104 after master), 40 ms attack, fade to zero by 650 ms, stopped at 700 ms. Only one cue may be active. No continuous oscillator or synthesized noise bed remains.

No remote audio request at runtime: the recording is served from `/assets/audio/rain-loop.mp3`. Loading begins after a trusted gesture. HTTP/decode errors and a 15-second load deadline fail safely; disposal aborts loading and releases all nodes. No missed door events are replayed.

Manual headphone/speaker acceptance remains necessary: rain identity (no noticeable voice/music/thunder), several-minute loop seam, baseline audibility, three rain states, door balance, and the quiet late-night mood. Automated tests do not certify these qualities.

Local asset SHA-256: `a088a482d198cc90ed8d1184eca193c8196a147f63802e074c92b234ad68620b`.
