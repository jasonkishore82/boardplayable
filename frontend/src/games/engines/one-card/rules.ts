// One Card's rules, pure and without React, so they can be tested.
//
// A 108-card deck in four colours: one 0 and two each of 1-9, skip, reverse
// and +2 per colour, plus four wilds and four wild +4s. Match the top card's
// colour or value, or play a wild and name the colour. Can't (or won't) play?
// Draw one; if it fits you may play it straight away, otherwise the turn
// passes. Down to one card, call "One!" — if someone catches you before the
// next move, you draw two. Empty your hand to win the round and score the
// cards left in everyone else's.

export type Kind = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | '+2' | 'wild' | '+4'

/** color is 0-3 (red, yellow, green, blue); null for the wilds. */
export type Card = { id: number; kind: Kind; color: number | null }

export type Player = { name: string; bot: boolean; hand: Card[] }

export type Rng = () => number

export type OneCardState = {
  players: Player[]
  draw: Card[] // the top of the draw pile is the end of the array
  discard: Card[] // the top card is the end of the array
  /** The colour in play: the top card's, or the one named for a wild. */
  color: number
  turn: number
  dir: 1 | -1
  /** The card the player on turn just drew and may still play, or null. */
  drawn: number | null
  /** Who has called "One!" while holding two cards or fewer. */
  called: boolean[]
  /** A player who went down to one card without calling, until the next move. */
  uncalled: number | null
  winner: number | null
  scores: number[]
  round: number
  /** What just happened, for the status line. */
  last: string
}

export const COLOR_NAMES = ['red', 'yellow', 'green', 'blue']
export const HAND_SIZE = 7

const NUMBERS: Kind[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const ACTIONS: Kind[] = ['skip', 'reverse', '+2']

export const isWild = (c: Card) => c.color === null

export function buildDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (let color = 0; color < 4; color++) {
    for (const kind of [...NUMBERS, ...ACTIONS]) {
      const copies = kind === '0' ? 1 : 2
      for (let i = 0; i < copies; i++) cards.push({ id: id++, kind, color })
    }
  }
  for (const kind of ['wild', '+4'] as Kind[]) for (let i = 0; i < 4; i++) cards.push({ id: id++, kind, color: null })
  return cards
}

export function shuffle<T>(xs: T[], rng: Rng = Math.random): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardPoints(c: Card): number {
  if (isWild(c)) return 50
  if (ACTIONS.includes(c.kind)) return 20
  return Number(c.kind)
}

export const cardName = (c: Card) => {
  if (c.kind === 'wild') return 'a wild'
  if (c.kind === '+4') return 'a wild +4'
  return `a ${COLOR_NAMES[c.color!]} ${c.kind}`
}

const next = (s: Pick<OneCardState, 'players' | 'dir'>, from: number, steps = 1) => {
  const n = s.players.length
  return (((from + s.dir * steps) % n) + n) % n
}

export const top = (s: OneCardState) => s.discard[s.discard.length - 1]

export function newRound(seats: { name: string; bot: boolean }[], scores?: number[], round = 1, rng: Rng = Math.random, starter = 0): OneCardState {
  let draw = shuffle(buildDeck(), rng)
  const players = seats.map((p) => ({ ...p, hand: [] as Card[] }))
  for (let r = 0; r < HAND_SIZE; r++) for (const p of players) p.hand.push(draw.pop()!)
  // turn up the first card, sliding any action or wild back into the pile so play starts on a number
  let first = draw.pop()!
  while (!NUMBERS.includes(first.kind)) {
    draw = [first, ...draw]
    first = draw.pop()!
  }
  return {
    players,
    draw,
    discard: [first],
    color: first.color!,
    turn: starter % players.length,
    dir: 1,
    drawn: null,
    called: players.map(() => false),
    uncalled: null,
    winner: null,
    scores: scores ?? players.map(() => 0),
    round,
    last: '',
  }
}

export function canPlay(s: OneCardState, c: Card): boolean {
  if (isWild(c)) return true
  const t = top(s)
  return c.color === s.color || c.kind === t.kind
}

export function playable(s: OneCardState, p = s.turn): Card[] {
  if (s.winner !== null || p !== s.turn) return []
  const hand = s.players[p].hand
  if (s.drawn !== null) return hand.filter((c) => c.id === s.drawn && canPlay(s, c))
  return hand.filter((c) => canPlay(s, c))
}

// Takes n cards off the draw pile into a hand, shuffling the discards (all but the top) back in when it runs out.
function give(s: OneCardState, p: number, n: number, rng: Rng): Card[] {
  const got: Card[] = []
  for (let i = 0; i < n; i++) {
    if (s.draw.length === 0) {
      if (s.discard.length <= 1) break
      const keep = s.discard.pop()!
      s.draw = shuffle(s.discard, rng)
      s.discard = [keep]
    }
    const c = s.draw.pop()!
    s.players[p].hand.push(c)
    got.push(c)
  }
  if (s.players[p].hand.length > 1) s.called[p] = false
  return got
}

const clone = (s: OneCardState): OneCardState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, hand: p.hand.slice() })),
  draw: s.draw.slice(),
  discard: s.discard.slice(),
  called: s.called.slice(),
  scores: s.scores.slice(),
})

const who = (s: OneCardState, p: number) => (s.players[p].bot ? s.players[p].name : 'You')
const plural = (s: OneCardState, p: number, n: number) => `${who(s, p)} ${s.players[p].bot ? 'draws' : 'draw'} ${n}`

/** Plays a card from the hand of the player on turn. `color` names the colour for a wild. */
export function play(s0: OneCardState, cardId: number, color?: number, rng: Rng = Math.random): OneCardState {
  const card = playable(s0).find((c) => c.id === cardId)
  if (!card) return s0
  const s = clone(s0)
  const p = s.turn
  const hand = s.players[p].hand
  hand.splice(
    hand.findIndex((c) => c.id === cardId),
    1,
  )
  s.discard.push(card)
  s.drawn = null
  s.uncalled = hand.length === 1 && !s.called[p] ? p : null
  s.color = isWild(card) ? (color ?? 0) % 4 : card.color!
  s.last = `${who(s, p)} played ${cardName(card)}${isWild(card) ? ` — ${COLOR_NAMES[s.color]}` : ''}.`

  if (hand.length === 0) {
    // the round is over; the last +2 or +4 still lands, then hands are counted
    const victim = next(s, p)
    if (card.kind === '+2') give(s, victim, 2, rng)
    if (card.kind === '+4') give(s, victim, 4, rng)
    s.winner = p
    s.uncalled = null
    s.scores[p] += s.players.reduce((sum, q) => sum + q.hand.reduce((a, c) => a + cardPoints(c), 0), 0)
    s.last = `${who(s, p)} went out!`
    return s
  }

  const n = s.players.length
  let steps = 1
  if (card.kind === 'skip') {
    steps = 2
    s.last += ` ${who(s, next(s, p))} ${next(s, p) === 0 ? 'are' : 'is'} skipped.`
  } else if (card.kind === 'reverse') {
    s.dir = s.dir === 1 ? -1 : 1
    if (n === 2) steps = 2 // with two players a reverse works like a skip
    s.last += ' Play reverses.'
  } else if (card.kind === '+2' || card.kind === '+4') {
    const victim = next(s, p)
    const k = card.kind === '+2' ? 2 : 4
    give(s, victim, k, rng)
    steps = 2
    s.last += ` ${plural(s, victim, k)} and ${victim === 0 ? 'miss your' : 'misses their'} turn.`
  }
  s.turn = next(s, p, steps)
  return s
}

/** The player on turn draws a card. If it can be played they may play it; otherwise the turn passes. */
export function drawCard(s0: OneCardState, rng: Rng = Math.random): OneCardState {
  if (s0.winner !== null || s0.drawn !== null) return s0
  const s = clone(s0)
  const p = s.turn
  s.uncalled = null
  const [c] = give(s, p, 1, rng)
  if (c && canPlay(s, c)) {
    s.drawn = c.id
    s.last = `${who(s, p)} drew a card.`
    return s
  }
  s.last = c ? `${who(s, p)} drew a card and passed.` : `${who(s, p)} passed — the pile is empty.`
  s.turn = next(s, p)
  return s
}

/** After drawing a playable card, keep it and pass. */
export function pass(s0: OneCardState): OneCardState {
  if (s0.drawn === null || s0.winner !== null) return s0
  const s = clone(s0)
  s.last = `${who(s, s.turn)} kept the card.`
  s.drawn = null
  s.turn = next(s, s.turn)
  return s
}

/** Call "One!": allowed while holding two cards (about to play down to one) or one card not yet caught. */
export function callOne(s0: OneCardState, p: number): OneCardState {
  const len = s0.players[p].hand.length
  if (len > 2 || s0.called[p] || s0.winner !== null) return s0
  const s = clone(s0)
  s.called[p] = true
  if (s.uncalled === p) s.uncalled = null
  s.last = `${who(s, p)} called One!`
  return s
}

/** Catch a player who went down to one card without calling: they draw two. */
export function catchOne(s0: OneCardState, catcher: number, rng: Rng = Math.random): OneCardState {
  const p = s0.uncalled
  if (p === null || p === catcher || s0.winner !== null) return s0
  const s = clone(s0)
  give(s, p, 2, rng)
  s.uncalled = null
  s.last = `${who(s, catcher)} caught ${p === 0 ? 'you' : s.players[p].name} — ${plural(s, p, 2)}.`
  return s
}

// ---- computer players ----

export type BotMove = { type: 'play'; card: number; color: number } | { type: 'draw' } | { type: 'pass' }

/** The colour this hand holds most of (by count), ignoring wilds. */
export function bestColor(hand: Card[], rng: Rng = Math.random): number {
  const counts = [0, 0, 0, 0]
  for (const c of hand) if (!isWild(c)) counts[c.color!]++
  const most = Math.max(...counts)
  if (most === 0) return Math.floor(rng() * 4)
  return counts.indexOf(most)
}

/**
 * A sensible bot: plays an action card on the next player when they are close
 * to going out, otherwise sheds the highest-scoring card that matches, and
 * holds its wilds back until nothing else fits.
 */
export function botMove(s: OneCardState, rng: Rng = Math.random): BotMove {
  const p = s.turn
  const options = playable(s, p)
  if (options.length === 0) return s.drawn !== null ? { type: 'pass' } : { type: 'draw' }
  const hand = s.players[p].hand
  const threat = s.players[next(s, p)].hand.length <= 2
  const score = (c: Card) => {
    let v = cardPoints(c)
    if (isWild(c)) v = c.kind === '+4' && threat ? 200 : -10 + (c.kind === '+4' ? 1 : 0)
    else if (threat && ACTIONS.includes(c.kind)) v += 100
    // prefer staying in the colour we hold most of
    if (!isWild(c) && c.color === bestColor(hand, rng)) v += 5
    return v + rng() * 0.5
  }
  const card = options.reduce((a, b) => (score(b) > score(a) ? b : a))
  const rest = hand.filter((c) => c.id !== card.id)
  return { type: 'play', card: card.id, color: isWild(card) ? bestColor(rest, rng) : card.color! }
}

export function handPoints(hand: Card[]) {
  return hand.reduce((a, c) => a + cardPoints(c), 0)
}
