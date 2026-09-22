// Traced on the locked 1536 × 1024 clean scene. Follow the actual foreground
// silhouette (countertop, tills and merchandise), not the rear cabinet behind Kai.
// The old broad diagonal clipped his torso before it met the counter, leaving a gap.
export const counterOcclusionOutline = Object.freeze([
  [203, 454], [204, 419], [231, 411], [233, 395], [251, 389],
  [263, 395], [268, 400], [285, 407], [287, 444], [303, 449],
  [318, 441], [337, 449], [343, 462], [358, 457],
  // Trace the BACK edge of the worktop. The small reader sits wholly inside it;
  // following its front edge would cut a notch and let Kai paint over the table.
  [368, 436], [403, 426], [408, 437], [410, 441],
  // E-0C: follow the stepped OUTER gold rim, not a chord inside the worktop.
  // These measured stations include its dark outline plus ~1 art px of guard
  // against clip-path antialiasing at fractional viewport scales.
  [415, 439], [440, 431], [465, 423], [490, 415], [515, 408], [535, 401],
  // Main till display, then the countertop merchandise display at the exit.
  [540, 399], [546, 385], [582, 374], [583, 395],
  [588, 394], [589, 366], [614, 359], [619, 390], [634, 385],
  [635, 326], [680, 315], [683, 371], [676, 374],
  [687, 379], [698, 372], [718, 377], [727, 409], [732, 416],
  // Outer right end and front panels hide legs without covering the public aisle.
  [732, 438], [732, 470], [732, 493], [730, 496], [315, 619], [203, 567],
].map(point => Object.freeze(point)))

export const counterOcclusion = `polygon(${counterOcclusionOutline
  .map(([x, y]) => `${x / 1536 * 100}% ${y / 1024 * 100}%`).join(', ')})`
