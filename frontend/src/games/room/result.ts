import type { RoomGame } from './RoomTable'

export type ResultTone = 'win' | 'loss' | 'draw' | 'neutral'

/** What the end-of-game card says. */
export type ResultInfo = {
  /** The big word: "Checkmate", "Stalemate", "Draw", "You win!". */
  title: string
  /** One line under it: who won and how. */
  detail: string
  /** "23 moves played", or null when no moves are known. */
  meta: string | null
  tone: ResultTone
}

type EndedGame = RoomGame & { reason?: string | null }

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Turns a finished game into the words for its result card. Returns null while the game is still being played.
 * `game.reason` is how it ended ("checkmate", "stalemate", "resignation", a draw rule); games without one
 * (tic-tac-toe) get a plain win, loss or draw.
 */
export function describeResult(gameId: string, game: EndedGame, myId: string | undefined): ResultInfo | null {
  const winner = game.winner
  if (!winner) return null

  const reason = game.reason ?? null
  const plies = game.history?.length ?? 0
  // Chess counts a move as a turn by each side; other games count every move.
  const count = gameId === 'chess' ? Math.ceil(plies / 2) : plies
  const meta = count > 0 ? `${count} ${count === 1 ? 'move' : 'moves'} played` : null

  if (winner === 'draw') {
    if (reason === 'stalemate') {
      return { title: 'Stalemate', detail: 'No legal moves, and no check. The game is drawn.', meta, tone: 'draw' }
    }
    return { title: 'Draw', detail: reason ? `Drawn by ${reason}.` : 'The game is a draw.', meta, tone: 'draw' }
  }

  const seat = game.seats[winner]
  const mine = !!myId && seat?.id === myId
  const seated = !!myId && Object.values(game.seats).some((s) => s?.id === myId)
  const name = seat?.username ?? capitalise(winner)
  const side = capitalise(winner)
  const tone: ResultTone = mine ? 'win' : seated ? 'loss' : 'neutral'

  if (reason === 'resignation') {
    const detail = mine ? 'Your opponent resigned.' : seated ? `You resigned. ${name} wins.` : `${name} wins by resignation.`
    return { title: 'Resignation', detail, meta, tone }
  }

  const title = reason === 'checkmate' ? 'Checkmate' : mine ? 'You win!' : seated ? 'You lose' : 'Game over'
  const detail = mine ? `You win as ${side}.` : `${name} wins as ${side}.`
  return { title, detail, meta, tone }
}
