# Stage 4.2C-3 — Kai asset correction

Purpose: correct character fidelity and walking readability before further movement polish. Generated with the built-in imagegen tool using the project's original `public/assets/scenes/after-hours.png` as the primary reference. No downloaded game art or runtime image API.

## Source and exports

- `kai-atlas.png`: unmodified selected generation, 1024×1536 RGBA; four equal 256×384 cells per row. Row 1 contains one idle frame; rows 2–4 contain side, front and back walk cycles.
- `kai-side-source.png`: subsequent side-only correction; replaces row 2 for runtime export, with clearer opposing arm swing. The atlas is retained intact as the common identity reference.
- `prompts.md`: initial generation, atlas arm-swing revision and side-only correction prompts.
- `registration.json`: source bounds and output placement for all 13 frames.
- Runtime idle: `public/assets/npcs/kai.png`, existing 351×988 canvas; visible height 928, baseline y=968.
- Runtime sheets: `public/assets/npcs/kai/kai-walk-{side,front,back}.png`, existing 2048×768 canvas; four 512×768 cells, visible height 720, baseline y=736, centered per cell. Left walking mirrors side as before.

Exports only split the atlas, register frame bounds, and resize with nearest-neighbor sampling. Alpha is thresholded at 128 for fully opaque pixel silhouettes / fully transparent background, removing the generated faint fringe; RGB artwork is not repainted. No smooth resampling or procedural limb generation. All frames retain original aspect ratio. The idle CSS registration changes to 928/988 so walking and standing retain the same visible height and bottom padding. No movement timing changes.

The original scene and clean plate, Mira and Cat are unchanged. Source artwork stays outside `public/` and is not included in the production bundle. The asset-revision hash in the existing sprite test identifies the replacement idle; background/Mira/Cat hashes remain unchanged.

## Art review

Compared with the previous sprites: small dark eyes replace oversized anime-style highlights; dark uneven hair, muted blue sleeves, short navy apron, restrained shoes and block-like shading follow the scene reference. Separated legs and larger alternating arm silhouettes make motion more legible at scene scale.

Use the existing development movement page to judge the result in context. Generated four-frame cycles still require human art approval: subtle head contour changes and side-view limb phase consistency are the main remaining review points. This is not a final movement-polish pass. Waypoints, route runner, cadence, speed, scene anchors and gameplay are unchanged.
