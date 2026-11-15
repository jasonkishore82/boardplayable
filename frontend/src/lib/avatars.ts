// Where profile pictures live. Drop image files in these places and they show up; nothing else to change.
// See public/avatars/README.md.

const EXTENSIONS = ['png', 'webp', 'jpg']

/** Pictures to try for a computer opponent, e.g. /avatars/bots/easy.png, then .webp, then .jpg. */
export function botAvatarUrls(botId: string): string[] {
  return EXTENSIONS.map((extension) => `/avatars/bots/${encodeURIComponent(botId)}.${extension}`)
}

/** A player's own picture, if they have set one. */
export function userAvatarUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  return trimmed ? trimmed : null
}

/** Players who are computer opponents have ids like "bot-easy" or "bot-maia-1500". */
export function isBotId(id: string | null | undefined): id is string {
  return !!id && id.startsWith('bot-')
}

/** The pictures to try for anyone in a room: a bot's portrait, or none for a person (initials are shown). */
export function playerAvatarUrls(id: string | null | undefined): string[] | undefined {
  return isBotId(id) ? botAvatarUrls(id.slice('bot-'.length)) : undefined
}
