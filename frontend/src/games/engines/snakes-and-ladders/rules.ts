// Snakes and ladders as the server sends it. The server rolls the dice and moves the tokens;
// this file only describes the state, the board's geometry, and words for the player.

import type { Seat } from '../../room/RoomTable'

export type Colour = 'red' | 'blue'

export type SnakesState = {
  /** Square 1-100, or 0 for a token that hasn't entered the board yet. */
  positions: Record<Colour, number>
  turn: Colour
  winner: Colour | null
  last: { seat: Colour; roll: number; from: number; to: number; via: 'ladder' | 'snake' | null } | null
  /** Foot square to top square, and head square to tail square. Keys are strings because they come from JSON. */
  ladders: Record<string, number>
  snakes: Record<string, number>
  round: number
  scores: Record<Colour, number>
  seats: { red: Seat; blue: Seat }
}

export const SIZE = 10

/** Column and row (row 0 is the bottom) of a square. Rows zigzag: 1-10 run left to right, 11-20 right to left. */
export function cellOf(square: number): { col: number; row: number } {
  const index = square - 1
  const row = Math.floor(index / SIZE)
  const along = index % SIZE
  return { col: row % 2 === 0 ? along : SIZE - 1 - along, row }
}

/** The middle of a square on a 100 x 100 drawing. */
export function centre(square: number): { x: number; y: number } {
  const { col, row } = cellOf(square)
  return { x: col * SIZE + SIZE / 2, y: (SIZE - 1 - row) * SIZE + SIZE / 2 }
}

/** Squares in the order they are drawn, top-left first. */
export const DRAW_ORDER: number[] = Array.from({ length: SIZE * SIZE }, (_, i) => {
  const row = SIZE - 1 - Math.floor(i / SIZE)
  const col = i % SIZE
  return row * SIZE + (row % 2 === 0 ? col : SIZE - 1 - col) + 1
})

export function myColour(state: SnakesState, myId: string | undefined): Colour | null {
  if (!myId) return null
  if (state.seats.red?.id === myId) return 'red'
  if (state.seats.blue?.id === myId) return 'blue'
  return null
}

const name = (seat: Seat) => seat?.username ?? 'Player'
const cap = (text: string) => text[0].toUpperCase() + text.slice(1)

/** What just happened, in words. */
export function lastLine(state: SnakesState, myId: string | undefined): string {
  const last = state.last
  if (!last) return ''
  const who = state.seats[last.seat]?.id === myId ? 'You' : name(state.seats[last.seat])
  const result =
    last.from === last.to
      ? ' and needs an exact roll to finish.'
      : last.via === 'ladder'
        ? ` and climbed a ladder to ${last.to}!`
        : last.via === 'snake'
          ? ` and slid down a snake to ${last.to}.`
          : ` and moved to ${last.to}.`
  return `${who} rolled a ${last.roll}${result}`
}

/** One line telling the player what is going on. */
export function statusLine(state: SnakesState, myId: string | undefined): string {
  const mine = myColour(state, myId)

  if (state.winner) {
    if (mine === state.winner) return 'You won!'
    return `${mine ? name(state.seats[state.winner]) : cap(state.winner)} won.`
  }
  if (!state.seats.red || !state.seats.blue) return 'Waiting for an opponent. Share the invite link.'
  if (!mine) return `${name(state.seats[state.turn])}’s turn to roll.`
  return mine === state.turn ? `Your turn. You are ${mine}.` : `Waiting for ${name(state.seats[state.turn])}…`
}
