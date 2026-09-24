export default function AmbientSpeechBubble({ speech }) {
  return <span className="ambient-speech" role="status" aria-label={`${speech.npcId.toUpperCase()}轻声说`}>
    {speech.text}
  </span>
}
