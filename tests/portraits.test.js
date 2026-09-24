import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { npcPortraits } from '../src/data/npcPortraits.js'
for (const [id, portrait] of Object.entries(npcPortraits)) test(`${id} portrait reuses transparent master pixels within source bounds`, () => {
  const png = readFileSync(new URL('../public' + portrait.src, import.meta.url))
  assert.equal(png.readUInt32BE(16), portrait.width)
  assert.equal(png.readUInt32BE(20), portrait.height)
  assert.equal(png[25], 6)
  const crop = portrait.crop
  assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= portrait.width && crop.y + crop.height <= portrait.height)
  assert.ok(crop.width >= 96 && crop.height < portrait.height)
})
