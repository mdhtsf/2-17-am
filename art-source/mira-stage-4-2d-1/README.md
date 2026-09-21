# Mira — Stage 4.2D-1 visual fidelity and scale correction

Asset correction only. The accepted `public/assets/npcs/kai.png` is the primary rendering/proportion reference; the original `public/assets/scenes/after-hours.png` supplies Mira's identity. Previous Stage 4.2D Mira supplies clothing continuity, not rendering style. Generated with the built-in imagegen tool; complete prompt in `prompts.md`. No external game artwork, new dependencies or runtime generation.

`mira-atlas.png` is the unmodified 1024×1536 RGBA source. Row 1 holds idle in its first cell; rows 2–4 hold four side/front/back frames. The simplified dark vertical eyes, clustered hair, broad jacket/limbs and restrained shading aim to match Kai's cast while preserving Mira's headband, dark hair, cream blouse, jacket, skirt, shoes and backpack.

## Runtime export and registration

- `public/assets/npcs/mira/mira-idle.png`: **411×911**, previously 401×911. The new silhouette needs 404 px at the retained height; the extra 10 px canvas width preserves it without clipping or non-uniform stretching. Visible height stays 860, top=25, foot baseline=885, bottom padding=26.
- `mira-walk-{side,front,back}.png`: unchanged **2048×768**, four **512×768** cells. Visible height=720, top=16, foot baseline=736, center=256.
- `registration.json` records every source crop and exported frame position. Exports threshold alpha at 128 to remove faint generated fringe, preserve RGB and resize uniformly using nearest-neighbor sampling. No procedural redrawing or smoothing.
- `src/data/npcVisuals.js`: Mira base width input **6.4 → 7.4**, multiplied by unchanged global 0.9, giving **5.76% → 6.66%** scene width (+15.625%). Accounting for the wider idle canvas, visible height grows **12.812%** at equal perspective. The existing perspective curve and all anchors are unchanged. Kai's 5.4% and Cat's 6.12% are unchanged.
- Existing `miraWalking.js` registration, frame indexing and bottom-center entity origin are unchanged. The idle canvas continues to reserve hotspot/label geometry for every phase.

This corrects art before further movement polish. Generated four-frame cycles can still have small hair/skirt/backpack contour changes, and leftward movement still mirrors the side atlas. These are visual limitations rather than changes to route, timing or behavior. Final art approval remains a scene-scale human judgement.

## Verification

160 Node tests and 434 browser regression checks passed, including both human walking cycles, foot anchoring, route continuity and interactions. Production build passed using the project Vite configuration with local environment-file loading disabled for validation. Movement harness inspected with Kai at shelf and Mira at notes_spot, plus Mira's window round trip; no browser errors or warnings. Hash comparison from the start of this pass confirms only these four Mira PNGs and `npcVisuals.js` changed under runtime code/assets; Kai, Cat, scene art and all movement/behavior/provider code remain byte-identical. The existing asset-revision test updates only Mira's idle hash. No commit, tag or push.
