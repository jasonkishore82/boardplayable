/** A short code for an invite link: always six digits, for example "048215". */
export function newRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => Math.floor(random() * 10)).join('')
}

/** Accepts a bare six-digit code (spaces and dashes are ignored) or a pasted invite link, and returns the code or null. */
export function parseRoomCode(input: string): string | null {
  const trimmed = input.trim()
  const fromLink = trimmed.match(/[?&]room=(\d{6})(?!\d)/)
  const code = fromLink ? fromLink[1] : trimmed.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(code) ? code : null
}
