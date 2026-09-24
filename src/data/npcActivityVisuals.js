// Original generated RGBA sheets; registration is measured in source pixels.
// Keep the accepted idle canvas, visible height and foot baseline unchanged.
const sheets = {
  kai: { src: '/assets/npcs/activities/kai-activities.png', columns: 3, rows: 1, cell: 724, visibleHeight: 928, bottomMargin: 20 },
  mira: { src: '/assets/npcs/activities/mira-activities.png', columns: 2, rows: 2, cell: 627, visibleHeight: 860, bottomMargin: 26 },
}
const pose = (npc, index, center, bottom, height) => Object.freeze({ ...sheets[npc], index, center, bottom, height })

export const npcActivityVisuals = Object.freeze({
  kai: Object.freeze({
    behind_counter: null, // The accepted counter idle remains the reference.
    making_coffee: pose('kai', 0, 424, 715, 699),
    checking_shelf: pose('kai', 1, 334, 715, 698),
    looking_out_window: pose('kai', 2, 296, 712, 697),
  }),
  mira: Object.freeze({
    reading_notes: pose('mira', 0, 329, 620, 551),
    checking_phone: pose('mira', 1, 285.5, 622, 552),
    choosing_drink: pose('mira', 2, 337, 592, 561),
    staring_out_window: pose('mira', 3, 297.5, 585, 554),
    talking_to_kai: null, // Quiet neutral stance at the counter opening.
  }),
})

export function getActivityVisual(npcId, activity) {
  return npcActivityVisuals[npcId]?.[activity] ?? null
}

export function activityFrameStyle(pose, visual) {
  const scale = pose.visibleHeight / pose.height
  return {
    width: `${pose.cell * scale / visual.width * 100}%`,
    height: `${pose.cell * scale / visual.height * 100}%`,
    bottom: `${(pose.bottomMargin - (pose.cell - pose.bottom) * scale) / visual.height * 100}%`,
    transform: `translateX(${-pose.center / pose.cell * 100}%)`,
  }
}
