// The game library. Every screen that lists games reads from here,
// so adding a game is one new entry in GAMES.

export type CategoryId = 'strategy' | 'classic' | 'cards'

export type Game = {
  /** URL-safe id, also used as the folder name under src/games/engines/. */
  id: string
  name: string
  /** One line, shown on the card. */
  description: string
  category: CategoryId
  /** Null when the count depends on the variant (e.g. card games). */
  players: { min: number; max: number } | null
  status: 'available' | 'coming-soon'
}

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'classic', label: 'Classic' },
  { id: 'cards', label: 'Cards' },
]

export const GAMES: Game[] = [
  {
    id: 'chess',
    name: 'Chess',
    description: 'The oldest duel on the board. Think three moves ahead.',
    category: 'strategy',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'battleship',
    name: 'Battleship',
    description: 'Hide your fleet, call your shots, sink theirs first.',
    category: 'strategy',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'snakes-and-ladders',
    name: 'Snakes and ladders',
    description: 'Roll, climb, slide. Pure luck, loud tables.',
    category: 'classic',
    players: { min: 2, max: 6 },
    status: 'coming-soon',
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-tac-toe',
    description: 'Three in a row. Over in a minute, rematch in two.',
    category: 'classic',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'cards',
    name: 'Card games',
    description: 'A deck, a table and a few familiar house rules.',
    category: 'cards',
    players: null,
    status: 'coming-soon',
  },
]

export function formatPlayers(players: Game['players']): string {
  if (!players) return 'Varies by game'
  const { min, max } = players
  if (min === max) return `${max} players`
  return `Up to ${max} players`
}

export function getGame(id: string | undefined): Game | undefined {
  return GAMES.find((g) => g.id === id)
}

export function groupByCategory(games: Game[] = GAMES) {
  return CATEGORIES.map((c) => ({ ...c, games: games.filter((g) => g.category === c.id) })).filter(
    (c) => c.games.length > 0,
  )
}
