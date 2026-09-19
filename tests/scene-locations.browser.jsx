import React, { act } from 'react'
import ConvenienceStoreScene from '../src/components/ConvenienceStoreScene.jsx'
import { npcActivities } from '../src/data/npcActivities.js'

// Nonvisual metadata is the only allowed markup difference between activities.
export const visualMarkup = html => html.replace(/ data-(?:activity|location)="[^"]*"/g, '')

export async function verifySceneLocations(root, container, check) {
  const expected = [
    ['counter', 'notes_spot', 'floor'],
    ['coffee_station', 'notes_spot', 'floor'],
    ['shelf', 'fridge', 'door'],
    ['window', 'window', 'aisle'],
  ]
  let baseline
  for (let step = 0; step < 4; step++) {
    const activities = Object.fromEntries(Object.entries(npcActivities).map(([id, cycle]) => [id, cycle[step]]))
    const before = JSON.stringify(activities)
    await act(async () => root.render(<ConvenienceStoreScene activities={activities} selectedId={null} catActive={false} />))
    const nodes = [...container.querySelectorAll('.npc')]
    check(nodes.map(node => node.dataset.location).join(',') === expected[step].join(','), `scene step ${step} derives correct isolated locations for all NPCs`)
    const markup = visualMarkup(container.innerHTML)
    if (step === 0) baseline = markup
    check(markup === baseline, `scene step ${step} preserves all visual markup, coordinates, labels and artwork`)
    check(JSON.stringify(activities) === before, `scene step ${step} does not mutate ambient state`)
  }
  check(!/logicalLocation|notes_spot|coffee_station|shelf_corner|aisle|window/.test(container.textContent), 'logical locations never appear in visible scene text')
  await act(async () => root.render(null))
}
