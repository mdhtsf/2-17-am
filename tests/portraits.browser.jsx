import React, { act } from 'react'
import App from '../src/App.jsx'
import { npcPortraits } from '../src/data/npcPortraits.js'

export async function verifyPortraits(root, container, check) {
  await act(async () => root.render(<App />))
  for (const id of ['kai', 'mira', 'kai', 'mira']) {
    await act(async () => container.querySelector(`.npc-${id}`).click())
    const portrait = container.querySelector('.dialogue .character-portrait')
    const image = portrait.querySelector('img')
    check(portrait.dataset.portrait === id && image?.getAttribute('src') === npcPortraits[id].src && image.complete && image.naturalWidth > 0,
      `${id}: switching immediately displays the correct predecoded portrait`)
    const face = portrait.getBoundingClientRect(), body = container.querySelector('.dialogue-body').getBoundingClientRect()
    check(face.right < body.left && body.width > face.width * 2, `${id}: left portrait supports a larger readable text column`)
    check(container.querySelector('h2').textContent === id.toUpperCase() && container.querySelector('form'), `${id}: portrait preserves English name and input behavior`)
  }
  await act(async () => container.querySelector('.close-dialogue').click())
  await act(async () => container.querySelector('.npc-cat').click())
  check(container.querySelector('.cat-feedback [data-portrait="cat"] img')?.getAttribute('src') === npcPortraits.cat.src,
    'Cat has a dedicated portrait in its existing local feedback panel')
  check(container.querySelector('.cat-feedback').textContent.includes('THE CAT') && container.querySelector('.cat-feedback').textContent.includes('没什么意思') && !container.querySelector('form'),
    'Cat keeps English name and local text without an API input')
  await act(async () => root.render(null))
}
