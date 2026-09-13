// Decorative only: the mask lives with the asset's coordinates in scene.js.
export default function RainOverlay({ mask }) {
  return <div className="weather-layer" style={{ clipPath: mask }} aria-hidden="true">
    {Array.from({ length: 56 }, (_, i) => (
      <i className="rain-drop" key={i} style={{
        left: `${(i * 37 + 7) % 100}%`,
        top: `${(i * 19) % 100}%`,
        '--delay': `${-i * 0.23}s`,
        '--duration': `${1.3 + (i % 4) * 0.3}s`,
      }} />
    ))}
  </div>
}
