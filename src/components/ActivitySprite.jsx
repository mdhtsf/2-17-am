import { activityFrameStyle } from '../data/npcActivityVisuals.js'

// One static cell, registered to the same feet as the accepted walking/idle art.
export default function ActivitySprite({ pose, visual, activity }) {
  return <span className="activity-sprite" data-pose={activity} aria-hidden="true"
    style={activityFrameStyle(pose, visual)}>
    <img src={pose.src} alt="" draggable="false" style={{
      width: `${pose.columns * 100}%`,
      left: `${-(pose.index % pose.columns) * 100}%`,
      top: `${-Math.floor(pose.index / pose.columns) * 100}%`,
    }} />
  </span>
}
