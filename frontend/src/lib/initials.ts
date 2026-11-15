/** "guest_4ee30b" -> "G4", "Easy Bot" -> "EB". Two letters at most, for a profile picture. */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const second = parts.length > 1 ? (parts[1][0] ?? '') : ''
  return (first + second).toUpperCase()
}
