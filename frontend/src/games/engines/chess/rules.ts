// Chess as the server sends it. The server is the referee and lists every legal move,
// so this file only describes the state and turns it into words for the player.

import type { Seat } from '../../room/RoomTable'

export type Color = 'white' | 'black'

export type ChessState = {
  /** Square name ("e4") to piece letter. Capitals are white: K Q R B N P. */
  board: Record<string, string>
  turn: Color
  winner: Color | 'draw' | null
  reason: string | null
  /** From square to the squares that piece may move to. Empty once the game is over. */
  legal: Record<string, string[]>
  last: [string, string] | null
  /** The square of the king in check, if any. */
  check: string | null
  round: number
  /** This round's moves in standard notation, e.g. ["e4", "e5", "Nf3"]. */
  history?: string[]
  scores: { white: number; black: number; draw: number }
  seats: { white: Seat; black: Seat }
  /** False until a player presses "Start game". Missing from older servers, which start at once. */
  live?: boolean
}

const FILES = 'abcdefgh'

/** Every square in the order they are drawn: white at the bottom, or black when `flipped`. */
export function squaresInOrder(flipped: boolean): string[] {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]
  const files = flipped ? [...FILES].reverse() : [...FILES]
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`))
}

export function isDark(square: string): boolean {
  return (FILES.indexOf(square[0]) + Number(square[1])) % 2 === 1
}

export function myColor(state: ChessState, myId: string | undefined): Color | null {
  if (!myId) return null
  if (state.seats.white?.id === myId) return 'white'
  if (state.seats.black?.id === myId) return 'black'
  return null
}

export function pieceColor(piece: string): Color {
  return piece === piece.toUpperCase() ? 'white' : 'black'
}

// The solid glyphs for both sides; the colour comes from CSS. The trailing \uFE0E keeps phones from
// swapping the pawn for an emoji.
const GLYPHS: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟\uFE0E' }
export const glyph = (piece: string) => GLYPHS[piece.toLowerCase()]

/** True when moving the piece on `from` to `to` is a pawn reaching the far end of the board, where it must be
 *  exchanged for another piece. */
export function isPromotion(board: Record<string, string>, from: string, to: string): boolean {
  return board[from]?.toLowerCase() === 'p' && (to[1] === '8' || to[1] === '1')
}

// How many of each piece a side starts with, strongest first. (The king is never taken.)
const STARTING: [string, number][] = [
  ['q', 1],
  ['r', 2],
  ['b', 2],
  ['n', 2],
  ['p', 8],
]

/**
 * The pieces `color` has lost, strongest first, as piece letters in that colour's case (e.g. ["Q", "P", "P"]).
 * Worked out from what is missing from the board, so a pawn that was promoted counts as a lost pawn.
 */
export function lostPieces(board: Record<string, string>, color: Color): string[] {
  const onBoard = Object.values(board).filter((piece) => pieceColor(piece) === color)
  return STARTING.flatMap(([letter, count]) => {
    const left = onBoard.filter((piece) => piece.toLowerCase() === letter).length
    const piece = color === 'white' ? letter.toUpperCase() : letter
    return Array<string>(Math.max(0, count - left)).fill(piece)
  })
}

const NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
export const pieceName = (piece: string) => `${pieceColor(piece)} ${NAMES[piece.toLowerCase()]}`

const name = (seat: Seat) => seat?.username ?? 'Player'
const cap = (text: string) => text[0].toUpperCase() + text.slice(1)

/** One line telling the player what is going on. */
export function statusLine(state: ChessState, myId: string | undefined): string {
  const mine = myColor(state, myId)

  if (state.winner === 'draw') return `It’s a draw by ${state.reason ?? 'agreement'}.`
  if (state.winner) {
    const by = state.reason ? ` by ${state.reason}` : ''
    if (mine === state.winner) return `You won${by}!`
    return `${mine ? name(state.seats[state.winner]) : cap(state.winner)} won${by}.`
  }
  if (!state.seats.white || !state.seats.black) return 'Waiting for an opponent. Share the invite link.'
  const check = state.check ? ' Check!' : ''
  if (!mine) return `${cap(state.turn)} to move.${check}`
  return mine === state.turn
    ? `Your move. You are ${mine}.${check}`
    : `Waiting for ${name(state.seats[state.turn])}…${check}`
}
