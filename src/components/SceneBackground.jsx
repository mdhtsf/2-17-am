// All merchandise, architecture, lighting and characters live in this one asset.
export default function SceneBackground({ scene }) {
  return <img
    className="scene-art"
    src={scene.src}
    width={scene.width}
    height={scene.height}
    alt={scene.description}
    draggable="false"
    fetchPriority="high"
  />
}
