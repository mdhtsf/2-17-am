import { sceneForegroundLayers } from '../data/sceneWaypoints.js'

// A scene-level compositing pass, above the entire NPC stacking context.
// Reuse original background pixels: only the traced foreground is painted.
// Never parent this inside an NPC layer whose depth changes at a waypoint.
export default function SceneForeground({ scene }) {
  return sceneForegroundLayers.map(layer => <img key={layer.id}
    className="scene-foreground" data-occluder={layer.id}
    src={scene.src} width={scene.width} height={scene.height}
    alt="" aria-hidden="true" draggable="false"
    style={{ clipPath: scene[layer.mask], zIndex: layer.zIndex }} />)
}
