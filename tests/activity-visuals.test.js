import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { npcActivityVisuals, getActivityVisual, activityFrameStyle } from '../src/data/npcActivityVisuals.js'
import { npcActivities } from '../src/data/npcActivities.js'
import { npcVisuals } from '../src/data/npcVisuals.js'

for (const id of ['kai', 'mira']) {
  test(`${id}: every existing activity has an explicit pose mapping`, () => {
    assert.deepEqual(Object.keys(npcActivityVisuals[id]), [...npcActivities[id]])
    assert.equal(getActivityVisual(id, 'unknown'), null)
    const cells = new Set()
    for (const activity of npcActivities[id]) {
      const pose = getActivityVisual(id, activity)
      if (id === 'kai' && activity === 'behind_counter') { assert.equal(pose, null); continue }
      assert.ok(pose)
      assert.ok(!cells.has(pose.index))
      cells.add(pose.index)
      const png = readFileSync(new URL(`../public${pose.src}`, import.meta.url))
      assert.equal(png.readUInt32BE(16), pose.columns * pose.cell)
      assert.equal(png.readUInt32BE(20), pose.rows * pose.cell)
      assert.equal(png[25], 6, 'PNG contains RGBA alpha')
      assert.ok(pose.index < pose.columns * pose.rows)
    }
  })
  test(`${id}: all activity crops retain accepted height and bottom-center feet`, () => {
    const visual = npcVisuals[id]
    for (const pose of Object.values(npcActivityVisuals[id]).filter(Boolean)) {
      const style = activityFrameStyle(pose, visual)
      const width = parseFloat(style.width) / 100 * visual.width
      const height = parseFloat(style.height) / 100 * visual.height
      const bottom = parseFloat(style.bottom) / 100 * visual.height
      assert.ok(Math.abs(width - height) < 1e-9, 'square source cell is not distorted')
      assert.ok(Math.abs(height * pose.height / pose.cell - pose.visibleHeight) < 1e-9)
      assert.ok(Math.abs(bottom + height * (pose.cell - pose.bottom) / pose.cell - pose.bottomMargin) < 1e-9)
      assert.equal(style.transform, `translateX(${-pose.center / pose.cell * 100}%)`)
    }
  })
}
test('Cat stays on its independent activity artwork', () => {
  for (const activity of npcActivities.cat) assert.equal(getActivityVisual('cat', activity), null)
})
