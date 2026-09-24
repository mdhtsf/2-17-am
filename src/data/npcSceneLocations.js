// Logical destinations only. Coordinates and independent artwork belong to Stage 4.2B.
export const npcSceneLocations = Object.freeze({
  kai: Object.freeze(['counter', 'coffee_station', 'shelf', 'window']),
  mira: Object.freeze(['fridge', 'notes_spot', 'drink_area', 'window', 'counter_chat']),
  cat: Object.freeze(['floor', 'shelf_corner', 'door', 'aisle']),
})

export const npcActivityLocations = Object.freeze({
  kai: Object.freeze({
    behind_counter: 'counter',
    making_coffee: 'coffee_station',
    checking_shelf: 'shelf',
    looking_out_window: 'window',
  }),
  mira: Object.freeze({
    reading_notes: 'notes_spot',
    checking_phone: 'notes_spot',
    choosing_drink: 'fridge',
    staring_out_window: 'window',
    talking_to_kai: 'counter_chat',
  }),
  cat: Object.freeze({
    sleeping: 'floor',
    grooming: 'floor',
    watching_door: 'door',
    wandering: 'aisle',
  }),
})
