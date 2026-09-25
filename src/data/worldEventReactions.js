import { activityChoices, AMBIENT_DIRECTOR } from '../game/ambientDirector.js'
import { getNpcSceneLocation } from '../game/npcSceneLocation.js'

export const WORLD_EVENTS = Object.freeze({
  opportunityMs: Object.freeze([45000, 90000]), lifetimeMs: 30000,
  reactionProbability: 0.5, barkProbability: 0.5, barkMs: 2500,
})
export function worldEventDelay(random = Math.random) {
  return 45000 + Math.floor(random() * 45001)
}

// Only semantic destinations; routes and coordinates remain owned by Stage 4.
export function getWorldReactionCandidates(event, activities, movements, locks = []) {
  const result = []
  const arrived = (id, location) => movements.get(id)?.phase === 'idle' && movements.get(id)?.destination === location
  function add(npcId, activity) {
    if (locks.includes(npcId)) return
    const current = activities[npcId]
    if (!arrived(npcId, getNpcSceneLocation(npcId, current))) return
    const choice = current === activity ? { distance: 0 } : activityChoices(npcId, current).find(c => c.activity === activity)
    if (!choice || choice.distance > AMBIENT_DIRECTOR.mediumDistance) return
    result.push({ npcId, activity, destination: getNpcSceneLocation(npcId, activity) })
  }
  if (['rain_intensifies', 'rain_softens', 'door_noise'].includes(event) &&
      activities.kai === 'behind_counter' && arrived('kai', 'counter')) add('kai', 'behind_counter')
  if (event === 'rain_intensifies') add('mira', 'staring_out_window')
  if (event === 'rain_softens' && activities.mira === 'staring_out_window') add('mira', 'staring_out_window')
  if (['rain_intensifies', 'door_noise'].includes(event) && activities.cat !== 'sleeping') add('cat', 'watching_door')
  return result
}
const barks = {
  rain_intensifies: {
    kai: ['又下大了。', '门口那块垫子该换了。', '先别急着走。'],
    mira: ['窗外都快看不清了。', '这一段写完，雨应该还在。', '今晚好像都不打算停。'],
  },
  rain_softens: {
    kai: ['雨小了点。', '门口总算没那么响了。'],
    mira: ['刚才还以为雨不会小了。', '小一点了。我的进度倒没变。'],
  },
  door_noise: { kai: ['门口好像响了一下。', '这门，风一吹就响。'] },
}
export function chooseWorldBark(event, npcId, previousText, random = Math.random) {
  const pool = barks[event]?.[npcId]?.filter(text => text !== previousText)
  return pool?.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : null
}
