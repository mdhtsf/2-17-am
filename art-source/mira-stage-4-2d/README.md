# Mira — Stage 4.2D source assets

Created with the built-in imagegen tool. Primary reference: the original `public/assets/scenes/after-hours.png`; supporting identity reference: `public/assets/npcs/mira.png`. These existing files were not modified. No downloaded game assets or runtime generation service.

- `mira-atlas.png`: selected unmodified 1024×1536 RGBA generation, after a targeted walk-pose correction. Row 1 contains one idle; rows 2–4 contain four side/front/back frames each.
- `prompts.md`: complete initial and correction prompts.
- `registration.json`: source crop bounds and export geometry for all 13 frames.
- Runtime output: `public/assets/npcs/mira/mira-idle.png` (401×911), and `mira-walk-{side,front,back}.png` (2048×768, four 512×768 cells).

Export uses alpha threshold 128 to remove faint generated fringe, trims frame bounds and resizes with nearest-neighbor sampling, preserving RGB artwork and aspect ratio. No procedural pose drawing. Idle visible height is 860 with top=25, foot baseline=885 (26 px bottom padding). Walk frames have visible height 720, top=16, baseline=736 and are horizontally centered. `miraWalking.js` maps this frame registration to the existing bottom-center entity; no sprite-center positioning.

The original scene guided the small eyes, dark hair/headband, muted jacket, pale blouse, pleated skirt, dark shoes and backpack. The corrected side cycle alternates extended and passing silhouettes; the front/back cycles reveal alternate feet beneath the skirt. Final pose/limb consistency still benefits from human art review at actual game scale. Four-frame animation and mirrored side lighting are retained prototype limitations, not a new movement design.

Only Mira art is added. Kai's accepted assets and size are unchanged. Shared movement uses the same 155 art-px/s, 8 fps, four-frame cycle and 125 ms arrival settle; Mira's original activity scheduling remains external to this visual layer.
