// Hand cricket as the server sends it. The server is the referee and keeps this ball's picks secret; this file only
// describes the state and turns it into words for the player.

export type Side = 'home' | 'away'
export type Seat = { id: string; username: string | null } | null

export type Ball = { batter: Side; bat: number; bowl: number; runs: number; out: boolean }

export type CricketState = {
  first: Side
  batting: Side
  innings: 1 | 2
  runs: Record<Side, number>
  wickets: Record<Side, number>
  balls: Record<Side, number>
  /** Runs the side batting second needs, once the second innings has begun. */
  target: number | null
  /** Who has picked for this ball. The numbers themselves stay on the server until both are in. */
  picked: Record<Side, boolean>
  last: Ball | null
  maxWickets: number
  maxBalls: number
  turn: Side
  winner: Side | 'draw' | null
  reason: string | null
  round: number
  /** This round's balls, e.g. "home 4 v 2: 4 runs". */
  history: string[]
  scores: Record<Side | 'draw', number>
  seats: Record<Side, Seat>
}

export const SIDES: Side[] = ['home', 'away']
export const other = (side: Side): Side => (side === 'home' ? 'away' : 'home')
export const sideLabel = (side: Side) => (side === 'home' ? 'Home' : 'Away')

export function mySide(state: CricketState, myId: string | undefined): Side | null {
  if (!myId) return null
  return SIDES.find((side) => state.seats[side]?.id === myId) ?? null
}

const name = (state: CricketState, side: Side) => state.seats[side]?.username ?? sideLabel(side)

/** 14 balls is "2.2" overs. */
export const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`

/** "24/1", runs for wickets. */
export const scoreText = (state: CricketState, side: Side) => `${state.runs[side]}/${state.wickets[side]}`

/** Whether this player can pick a number right now. */
export function canPick(state: CricketState, myId: string | undefined): boolean {
  const mine = mySide(state, myId)
  if (!mine || state.winner) return false
  if (!state.seats.home || !state.seats.away) return false
  return !state.picked[mine]
}

/** One line telling the player what is going on. */
export function statusLine(state: CricketState, myId: string | undefined): string {
  const mine = mySide(state, myId)
  if (state.winner === 'draw') return 'Scores level. It’s a draw.'
  if (state.winner) {
    if (mine === state.winner) return 'You won!'
    return `${name(state, state.winner)} won.`
  }
  if (!state.seats.home || !state.seats.away) return 'Waiting for an opponent. Share the invite link.'
  if (!mine) return `${name(state, state.batting)} is batting.`
  const role = mine === state.batting ? 'You’re batting' : 'You’re bowling'
  if (state.picked[mine]) return `${role}. Waiting for ${name(state, other(mine))}…`
  return `${role}. Pick a number.`
}

/** What happened on the last ball, from this player's point of view. */
export function lastLine(state: CricketState, myId: string | undefined): string {
  const ball = state.last
  if (!ball) return state.innings === 2 ? '' : 'Match the batter’s number to take a wicket.'
  const mine = mySide(state, myId)
  const batter = mine === ball.batter ? 'You' : name(state, ball.batter)
  const bowler = mine === other(ball.batter) ? 'you' : name(state, other(ball.batter))
  if (ball.out) return `${batter} played ${ball.bat} and ${bowler} bowled ${ball.bowl}. Out!`
  const runs = `${ball.runs} ${ball.runs === 1 ? 'run' : 'runs'}`
  return `${batter} played ${ball.bat}, ${bowler} bowled ${ball.bowl}. ${runs}.`
}

/** "Away need 12 from 9 balls", or null outside a chase. */
export function chaseLine(state: CricketState, myId: string | undefined): string | null {
  if (state.innings !== 2 || state.winner || state.target === null) return null
  const side = state.batting
  const need = state.target - state.runs[side]
  const left = state.maxBalls - state.balls[side]
  const who = mySide(state, myId) === side ? 'You need' : `${name(state, side)} needs`
  return `${who} ${need} from ${left} ${left === 1 ? 'ball' : 'balls'}.`
}

/** The balls of one side's innings as short marks: the runs scored, or "W" for a wicket. */
export function innings(state: CricketState, side: Side): string[] {
  return state.history
    .filter((line) => line.startsWith(`${side} `))
    .map((line) => (line.endsWith('out') ? 'W' : String(parseInt(line.split(': ')[1], 10))))
}
