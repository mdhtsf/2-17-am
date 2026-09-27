# Cat idle micro poses

`cat-micro-poses.png` is a generated transparent atlas (2026-09-27), using the project's accepted `cat-watching.png` as the character/style reference. Left: yawning; right: scratching. No downloaded game artwork.

The original generated image is kept intact. `src/data/catMicroVisuals.js` registers its two cells to the existing 224×192 sprite footprint and bottom ground line. Existing cat assets, scale, route graph and activity definitions are unchanged. It is preloaded through the normal sprite cache and switched only when decoded.

These static poses last 2–4 seconds, with opportunities 60–100 seconds apart and 50% probability when awake and settled. Movement, semantic activity change, player dialogue/cat interaction, or an active world event cancels/blocks them. They do not assign activities or produce a meow.

Visual style, registration and pose readability at scene scale still require manual acceptance.
