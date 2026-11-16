// The game library. Every screen that lists games reads from here,
// so adding a game is one new entry in GAMES.

export type CategoryId = 'strategy' | 'classic' | 'arcade' | 'casino' | 'sports'

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
  /** A coming-soon game listed under "Play now" ahead of its release. Its card says "Coming soon" instead of playing. */
  showcase?: boolean
}

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'classic', label: 'Classic' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'casino', label: 'Casino' },
  { id: 'sports', label: 'Sports' },
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
    id: 'face-board',
    name: 'Face Board',
    description: 'Fill the board with your own photos, pick a secret face and flip frames down as you guess.',
    category: 'classic',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'free-flight',
    name: 'Free Flight',
    description: 'No score, no crashes. Four ways to fly: a sunset sea, sky islands, a nebula or an asteroid belt.',
    category: 'arcade',
    players: { min: 1, max: 1 },
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
    status: 'available',
  },
  {
    id: 'roulette',
    name: 'Roulette',
    description: 'Place your chips on a number or colour, spin the wheel and watch where the ball settles.',
    category: 'casino',
    players: { min: 1, max: 1 },
    status: 'available',
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Texas hold'em: bet, bluff and make the best five-card hand.",
    category: 'casino',
    players: { min: 2, max: 8 },
    status: 'coming-soon',
  },
  {
    id: 'bowling',
    name: 'Bowling',
    description: 'Four lanes, ten frames. Flick the mouse or swing your phone to roll strikes and spares.',
    category: 'sports',
    players: { min: 1, max: 4 },
    status: 'available',
  },
  {
    id: 'cricket-nets',
    name: 'Cricket Nets',
    description: 'Face a bowling machine on a full-size 3D pitch. Swing with the mouse, or use your phone as the bat.',
    category: 'sports',
    players: { min: 1, max: 1 },
    status: 'coming-soon',
  },
  {
    id: 'cricket',
    name: 'Hand Cricket',
    description: 'Each ball, you both pick 1 to 6. Match the batter and they are out; otherwise they score what they picked.',
    category: 'sports',
    players: { min: 2, max: 2 },
    status: 'coming-soon',
  },
  {
    id: 'badminton',
    name: 'Badminton',
    description: 'Singles against the computer on a full-size court. Click to swing, or swing your phone like a racket.',
    category: 'sports',
    players: { min: 1, max: 1 },
    status: 'coming-soon',
  },
  {
    id: 'tennis',
    name: 'Tennis',
    description: 'Serve, rally and break. Win the points, the games and the set.',
    category: 'sports',
    players: { min: 2, max: 4 },
    status: 'coming-soon',
  },
  {
    id: 'table-tennis',
    name: 'Table tennis',
    description: 'Fast rallies across a small table. First to 11 points takes the game.',
    category: 'sports',
    players: { min: 2, max: 4 },
    status: 'coming-soon',
  },
  {
    id: 'carrom',
    name: 'Carrom',
    description: 'Flick the striker to pocket your coins and the queen on a square wooden board.',
    category: 'classic',
    players: { min: 2, max: 4 },
    status: 'coming-soon',
  },
]

export function formatPlayers(players: Game['players']): string {
  if (!players) return 'Varies by game'
  const { min, max } = players
  if (max === 1) return 'Single player'
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
