// The game library. Every screen that lists games reads from here,
// so adding a game is one new entry in GAMES.

export type CategoryId = 'strategy' | 'classic'

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
]

export const GAMES: Game[] = [
  {
    id: 'chess',
    name: 'Chess',
    description: 'Two players, one king each. Checkmate to win.',
    category: 'strategy',
    players: { min: 2, max: 2 },
    status: 'available',
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-tac-toe',
    description: 'Get three in a row before your opponent does.',
    category: 'classic',
    players: { min: 2, max: 2 },
    status: 'available',
  },
  {
    id: 'cricket',
    name: 'Cricket',
    description: 'Hand cricket: pick 1 to 6 each ball. Match the batter to bowl them out.',
    category: 'classic',
    players: { min: 2, max: 2 },
    status: 'available',
  },
  {
    id: 'warship',
    name: 'Warship',
    description: 'Hide your fleet, call your shots, sink theirs first.',
    category: 'strategy',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'snakes-and-ladders',
    name: 'Snakes and ladders',
    description: 'Roll the dice, climb the ladders, dodge the snakes.',
    category: 'classic',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'game-of-life',
    name: 'The Game of Life',
    description: 'Spin the wheel and take on careers, family and fortune on the road to retirement.',
    category: 'classic',
    players: { min: 2, max: 6 },
    status: 'coming-soon',
  },
  {
    id: 'one-card',
    name: 'One Card',
    description: 'Match the colour or number, play your cards, and shout when you are down to one.',
    category: 'classic',
    players: { min: 2, max: 10 },
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
