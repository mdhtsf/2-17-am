// Locked 1536×1024 scene: the NEAR merchandise gondola, in front of Cat's
// shelf-front corridor. Trace package tops, the sign and the end-cap bottles.
// This is not the taller central shelf behind Cat, nor the floor between rows.
export const shelfOcclusionOutline = Object.freeze([
  [493, 685], [519, 676], [520, 670], [548, 662], [552, 660],
  [572, 654], [578, 658], [578, 650], [589, 645], [612, 658],
  [612, 666], [620, 665], [636, 675], [644, 682],
  // Sloping top of the dark aisle sign, then the individual cream packages.
  [650, 696], [667, 708], [686, 721], [707, 734], [708, 739],
  [720, 734], [740, 749], [741, 757], [745, 755], [768, 771],
  [769, 778], [776, 774], [796, 789], [798, 797], [803, 797],
  // End rack and the stacked cartons behind it.
  [805, 809], [813, 807], [826, 816], [826, 821], [833, 821],
  [835, 841], [850, 848], [854, 855], [847, 861],
  // Bottle caps / shoulders on the outward-facing end display.
  [852, 858], [860, 860], [861, 866], [854, 870],
  [863, 872], [864, 877], [870, 879], [870, 913],
  [892, 927], [892, 934], [905, 931], [908, 951], [921, 961],
  [923, 1024], [741, 1024], [492, 881],
].map(point => Object.freeze(point)))

export const shelfOcclusion = `polygon(${shelfOcclusionOutline
  .map(([x, y]) => `${x / 1536 * 100}% ${y / 1024 * 100}%`).join(', ')})`
