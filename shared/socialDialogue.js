// Shared structural guard only; character instructions remain server-side.
export function socialSchemaIssue(value) {
  if (!value || !Array.isArray(value.lines)) return 'Expected an object with a lines array'
  if (value.lines.length < 2 || value.lines.length > 4) return 'lines must contain 2 to 4 entries'
  const speakers = new Set()
  for (const [i, line] of value.lines.entries()) {
    if (!line || !['kai', 'mira'].includes(line.speaker)) return `lines[${i}].speaker must be kai or mira`
    if (typeof line.text !== 'string') return `lines[${i}].text must be a string`
    const text = line.text.trim().replace(/\s+/g, ' ')
    if (!text || text.length > 64) return `lines[${i}].text must contain 1 to 64 characters`
    if (/[<>\u0000-\u001f]/.test(text) || /reasoning|system prompt|OpenRouter|作为.*AI/i.test(text)) return `lines[${i}].text contains non-dialogue markers`
    speakers.add(line.speaker)
  }
  return speakers.size === 2 ? null : 'Both Kai and Mira must participate'
}
export function sanitizeSocialDialogue(value) {
  if (socialSchemaIssue(value)) return null
  return { lines: value.lines.map(({speaker, text}) => ({speaker, text: text.trim().replace(/\s+/g, ' ')})) }
}

// Bounded prior dialogue is untrusted data, never system instructions.
export function sanitizeRecentExchanges(value = []) {
  if (!Array.isArray(value) || value.length > 3) return null
  const recent = value.map(sanitizeSocialDialogue)
  return recent.every(Boolean) ? recent : null
}
