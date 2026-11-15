import type { CSSProperties } from 'react'
import type { CategoryId, Game } from '../../games/catalog'

// Cover colours for the dashboard's banner and cards. Each game gets two colours that suit its icon; a game added to
// the catalog without an entry here falls back to its category's colours, so it still gets a proper cover.

type Pair = [string, string]

const BY_GAME: Record<string, Pair> = {
  chess: ['#c98a4b', '#4a230d'],
  'tic-tac-toe': ['#ff5fa2', '#4b23b8'],
  'free-flight': ['#5d87c9', '#e89a6c'],
  'free-fly': ['#2f6fd0', '#5ad1ff'],
  warship: ['#2fb7ff', '#0b3570'],
  'snakes-and-ladders': ['#57c36a', '#18552e'],
  'game-of-life': ['#ffb347', '#c73e85'],
  'one-card': ['#ff4d4d', '#e0a21b'],
  roulette: ['#1f9d55', '#0a3320'],
  poker: ['#d62f4b', '#33091a'],
  bowling: ['#6a7bff', '#1a2066'],
  cricket: ['#8bc34a', '#24501a'],
  badminton: ['#9fb4d8', '#2e3f66'],
  tennis: ['#c6d93f', '#2f6b25'],
  'table-tennis': ['#ff7043', '#1e3a8a'],
}

const BY_CATEGORY: Record<CategoryId, Pair> = {
  strategy: ['#8a4dff', '#2a1366'],
  classic: ['#ff5a6e', '#6a1430'],
  arcade: ['#3fb6ff', '#173a7a'],
  casino: ['#1f9d55', '#0a3320'],
  sports: ['#ffb347', '#7a3a10'],
}

// Real in-game frames (public/covers/), captured from each game's 3D view. A game listed here shows its frame on the
// banner and its card; the others show their icon on a tint until they have one. To add or refresh one, drop a
// 16:9-ish JPEG named after the game id into public/covers/ and list it here.
const SHOTS: Record<string, string> = {
  chess: '/covers/chess.jpg',
  'tic-tac-toe': '/covers/tic-tac-toe.jpg',
  'free-flight': '/covers/free-flight.jpg',
  'free-fly': '/covers/free-fly.jpg',
}

/** The game's in-game screenshot, when it has one. */
export function coverShot(game: Game): string | undefined {
  return SHOTS[game.id]
}

/** CSS variables --c1 and --c2 for a game's cover. The stylesheet mutes them toward slate, so they read as an
 *  accent rather than a toy box. */
export function coverStyle(game: Game): CSSProperties {
  const [c1, c2] = BY_GAME[game.id] ?? BY_CATEGORY[game.category]
  return { '--c1': c1, '--c2': c2 } as CSSProperties
}
