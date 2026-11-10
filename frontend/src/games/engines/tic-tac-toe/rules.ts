// Tic-tac-toe as the server sends it. The server is the referee; this file only describes the state
// and turns it into words for the player.

export type Mark = 'X' | 'O'
export type Seat = { id: string; username: string | null } | null

export type TttState = {
  board: (Mark | null)[]
  turn: Mark
  winner: Mark | 'draw' | null
  line: number[] | null
  round: number
  scores: { X: number; O: number; draw: number }
  seats: { X: Seat; O: Seat }
}

export function myMark(state: TttState, myId: string | undefined): Mark | null {
  if (!myId) return null
  if (state.seats.X?.id === myId) return 'X'
  if (state.seats.O?.id === myId) return 'O'
  return null
}

const name = (seat: Seat) => seat?.username ?? 'Player'

/** One line telling the player what is going on. */
export function statusLine(state: TttState, myId: string | undefined): string {
  const mine = myMark(state, myId)

  if (state.winner === 'draw') return 'It’s a draw.'
  if (state.winner) {
    if (mine === state.winner) return 'You won!'
    return mine ? `${name(state.seats[state.winner])} won.` : `${name(state.seats[state.winner])} won the round.`
  }
  if (!state.seats.X || !state.seats.O) return 'Waiting for an opponent. Share the invite link.'
  if (!mine) return `${name(state.seats[state.turn])}’s turn.`
  return mine === state.turn ? `Your turn. You are ${mine}.` : `Waiting for ${name(state.seats[state.turn])}…`
}

/** Whether this player can take this square right now. */
export function canPlay(state: TttState, myId: string | undefined, cell: number): boolean {
  if (state.winner || state.board[cell] !== null) return false
  if (!state.seats.X || !state.seats.O) return false
  return myMark(state, myId) === state.turn
}

/** A short code for an invite link: six letters and numbers. */
export function newRoomCode(random: () => number = Math.random): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (i, l, o, 0, 1)
  return Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
}

/** Accepts a bare code or a pasted invite link, and returns the room code or null. */
export function parseRoomCode(input: string): string | null {
  const trimmed = input.trim()
  const fromLink = trimmed.match(/[?&]room=([a-z0-9]{4,16})/i)
  const code = (fromLink ? fromLink[1] : trimmed).toLowerCase()
  return /^[a-z0-9]{4,16}$/.test(code) ? code : null
}
