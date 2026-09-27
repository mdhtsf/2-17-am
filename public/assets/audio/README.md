# Local soundscape assets

`rain-loop.mp3` — derived from **Ove Melaa – Rainy (NOT loopable)**.

- Author: Ove Melaa / OveMelaa.
- Source: https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available
- Original: https://opengameart.org/sites/default/files/Ove%20Melaa%20-%20Rainy%20%28NOT%20loopable%29.ogg
- License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), verified on source page 2026-09-25. Attribution not required; retained here voluntarily. This license applies to this audio, not to unrelated project assets.

Local adaptation: take seconds 15–47 of the original; high-pass at 90 Hz, low-pass at 6500 Hz, +20 dB to compensate for the very quiet source. Reorder the middle 28 seconds followed by a 2-second equal-power tail/head crossfade. The loop boundary then joins consecutive source samples. Encode stereo 44.1 kHz MP3 at 128 kbps, approximately 481 KB / 30 seconds. Browser decode removes encoder padding where supported; loop seams still require listening across browsers.

FFmpeg measured the encoded file at about -23 dBFS mean / -4 dBFS peak. These measurements check headroom, not subjective sound quality or absence of distracting sounds.

Controller gains: master 0.65; rain softened 0.22, baseline 0.34, intensified 0.46. Effective gains are 0.143 / 0.221 / 0.299. Expected baseline mean level is approximately -36 dBFS. Rain changes take 3 seconds; first unlock fades in over 2 seconds; mute/unmute over 0.2 seconds. Values are absolute, never compounded.

The door is an original 720 Hz sine cue, gain 0.16 before master (peak 0.104 after master), 40 ms attack, fade to zero by 650 ms, stopped at 700 ms. Only one cue may be active. No continuous oscillator or synthesized noise bed remains.

No remote audio request at runtime: the recording is served from `/assets/audio/rain-loop.mp3`. Loading begins after a trusted gesture. HTTP/decode errors and a 15-second load deadline fail safely; disposal aborts loading and releases all nodes. No missed door events are replayed. Optional one-shots described below load independently after the rain bed starts, so a failed one-shot does not disable rain or the door.

Manual headphone/speaker acceptance remains necessary: rain identity (no noticeable voice/music/thunder), several-minute loop seam, baseline audibility, three rain states, door balance, and the quiet late-night mood. Automated tests do not certify these qualities.

Local asset SHA-256: `a088a482d198cc90ed8d1184eca193c8196a147f63802e074c92b234ad68620b`.


## Final Polish: sparse window-drop detail

`window-drops.mp3` — an 8-second excerpt (seconds 8–16) from **Rain on car windshield**, sound #1295, by Joseph SARDIN / BigSoundBank.

- Source and license: https://bigsoundbank.com/rain-on-car-windshield-s1295.html
- Original MP3: https://bigsoundbank.com/UPLOAD/mp3/1295.mp3
- CC0 / public-domain equivalent, including modification, redistribution, and commercial use; verified on the source page 2026-09-27. https://creativecommons.org/publicdomain/zero/1.0/
- Local adaptation: high-pass 250 Hz, low-pass 4300 Hz, +10 dB to raise a quiet recording, mono 44.1 kHz MP3 at 96 kbps. 96,906 bytes. No added thunder, synthesizer, or storm layer.
- SHA-256: `980e05c81fb4ecf92d5c938e5215f5db6048df3b380020dddaaa991b613a3447`.

This is not an extra continuous loop. Every randomized 3–8 seconds, a 55% chance permits a softly enveloped 0.32–0.55 second snippet at a randomized offset and playback rate 0.95–1.05. Gain caps before master: softened 0.08, baseline 0.10, intensified 0.12, further varied by 0.75–1.0. No overlap within this layer. The source is actual raindrops on glass; at this low gain, distinguishable detail and acceptable naturalness still need headphone/speaker listening.

## Final Polish: Cat meow

`cat-meow.mp3` — **Little meow of a cat #9**, sound #1479, by Joseph SARDIN / BigSoundBank (cat: Emi).

- Source and license: https://bigsoundbank.com/little-meow-of-a-cat-9-s1479.html
- Original MP3: https://bigsoundbank.com/UPLOAD/mp3/1479.mp3
- CC0 / public-domain equivalent, including modification, redistribution, and commercial use; verified on the source page 2026-09-27. https://creativecommons.org/publicdomain/zero/1.0/
- Local adaptation: low-pass 6000 Hz, gain 0.5, 10 ms entry / final 50 ms fade, mono 44.1 kHz MP3 at 96 kbps. 0.759 seconds, 10,075 bytes.
- SHA-256: `0ad0fa7a72818a381d81f56b59345cd0c360b56120929deeafd990ef746d5bdb`.

After the asset is ready, each randomized 20–40 second opportunity has a 35% chance to play. Expected average is roughly 86 seconds per meow, not a fixed interval. Gain 0.22 before master (0.143 effective); never more than one active meow. No animation/activity/world-event coupling.

Both optional layers use local recordings, each with a 15-second fetch deadline. Muted/suspended opportunities are discarded, not queued. Muting stops active optional cues; unmuting does not replay them. Disposal aborts pending loads, clears timers, and stops/disconnects nodes. Existing trusted unlock, rain fades, weather events, and door behavior remain in the same controller.

FFmpeg measurement after adaptation: both new recordings about -21.5 dBFS mean; cat peak -5.6 dBFS, window-drop peak -6.8 dBFS. These are headroom checks only. Human acceptance must check low-volume clarity, atmosphere, repetitiveness, and balance against rain over several minutes.
