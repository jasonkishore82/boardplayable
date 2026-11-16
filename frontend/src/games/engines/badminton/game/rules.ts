// Badminton's rules for one game of singles: rally scoring, who serves from which court, and who wins a rally.
//
//   rally scoring  every rally wins a point, whoever served
//   game           first to `to` points (21 by the Laws), but two clear; at 29-all the 30th point wins (an 11-point
//                  game caps at 15)
//   service        the rally's winner serves next, from their right service court when their own score is even and
//                  their left when it is odd, diagonally into the opposite court
//   faults         the shuttle landing out, in the net, or (on the serve) outside the diagonal service court loses
//                  the rally for whoever hit it; landing in on a side loses it for that side

import { COURT } from '../badmintoncourt/textures.js'
import { inSingles, sgn, sideOf } from './shuttle'

export type Side = 0 | 1
export type Score = { points: [number, number]; server: Side; to: number; winner: Side | null }

export const newGame = (to: 11 | 21 = 21, server: Side = 0): Score => ({ points: [0, 0], server, to, winner: null })

const cap = (to: number) => (to === 21 ? 30 : to + 4)

export function gameWinner(points: readonly [number, number], to: number): Side | null {
  for (const s of [0, 1] as const) {
    const me = points[s]
    const them = points[1 - s]
    if (me >= cap(to)) return s
    if (me >= to && me - them >= 2) return s
  }
  return null
}

/** One rally to `side`: they score and serve next. */
export function award(score: Score, side: Side): Score {
  if (score.winner !== null) return score
  const points: [number, number] = [...score.points]
  points[side] += 1
  return { ...score, points, server: side, winner: gameWinner(points, score.to) }
}

/** The server's service court, as they see it: right when their score is even. */
export const serveCourt = (score: Score): 'right' | 'left' => (score.points[score.server] % 2 === 0 ? 'right' : 'left')

/**
 * Which way z points for "right" as a side sees it, facing the net. Side 0 faces +x, so their right hand is +z;
 * side 1 faces -x, so theirs is -z.
 */
export const rightZ = (side: Side) => (side === 0 ? 1 : -1)

/** Where the server stands to serve: just behind the short service line, in the court the score says. */
export function servePosition(score: Score) {
  const s = score.server
  const zSign = rightZ(s) * (serveCourt(score) === 'right' ? 1 : -1)
  return { x: sgn(s) * (COURT.short + 1.4), z: zSign * 0.75 }
}

/** The receiving court: diagonally opposite the server (z on the other side of the centre line). */
export function receiveCourt(score: Score) {
  const r = (1 - score.server) as Side
  const zSign = -Math.sign(servePosition(score).z)
  return { side: r, zSign }
}

/** Is a serve's landing spot in the service court it had to reach (singles: past the short line, inside the court)? */
export function serveIn(score: Score, x: number, z: number) {
  const { side, zSign } = receiveCourt(score)
  return sideOf(x) === side && Math.abs(x) >= COURT.short && Math.abs(x) <= COURT.L2 && Math.sign(z) === zSign && Math.abs(z) <= COURT.S2
}

/**
 * Who wins the rally once the shuttle comes down at (x, z). `lastHitter` played the last shot; `serve` says whether
 * that shot was the serve; `netted` that it caught the net.
 */
export function rallyWinner(score: Score, landing: { x: number; z: number }, lastHitter: Side, serve: boolean, netted: boolean): { winner: Side; call: 'in' | 'out' | 'net' | 'fault' } {
  const other = (1 - lastHitter) as Side
  if (netted && sideOf(landing.x) === lastHitter) return { winner: other, call: 'net' }
  if (serve && !serveIn(score, landing.x, landing.z)) return { winner: other, call: 'fault' }
  if (!inSingles(landing.x, landing.z)) return { winner: other, call: 'out' }
  // in: whoever's half it came down in has lost it
  const lost = sideOf(landing.x)
  return { winner: (1 - lost) as Side, call: 'in' }
}
