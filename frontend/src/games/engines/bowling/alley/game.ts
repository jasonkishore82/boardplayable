// The game around the lanes: whose turn it is, what a ball does to the score, how a computer bowler aims, and how a
// phone's tilt becomes a throw. Pure logic, so it can be tested.

import { scoreGame } from './score'

export type Player = { name: string; bot: boolean; rolls: number[] }
export type Throw = { x: number; angle: number; speed: number; hook: number }
export type Hook = 'straight' | 'hook' | 'big'

export const HOOKS: { id: Hook; name: string; spin: number }[] = [
  { id: 'straight', name: 'Straight', spin: 0 },
  { id: 'hook', name: 'Hook', spin: 8 },
  { id: 'big', name: 'Big hook', spin: 14 },
]

/** Where the bowler can stand along the foul line (m either side of the middle). */
export const STANCE = 0.42
export const SPEED = { min: 5, max: 10.5, normal: 8 }

// the pin spots across the lane (x, m), in pin order 1-10
const PIN_X = [0, -0.152, 0.152, -0.305, 0, 0.305, -0.457, -0.152, 0.152, 0.457]

/** The result of one ball for this player: their new rolls, and whether their turn (the frame) is over. */
export function applyBall(rolls: readonly number[], pins: number) {
  const before = scoreGame(rolls)
  const standingBefore = before.standing
  const next = [...rolls, Math.max(0, Math.min(standingBefore, pins))]
  const after = scoreGame(next)
  const frameOver = after.done || after.frame !== before.frame
  return { rolls: next, frameOver, fullRack: frameOver || after.fullRack, done: after.done, standingBefore, wasFullRack: before.fullRack }
}

/** The next player still bowling after `current`, in turn order, or -1 when everyone has finished. */
export function nextPlayer(players: readonly Player[], current: number): number {
  for (let k = 1; k <= players.length; k++) {
    const i = (current + k) % players.length
    if (!scoreGame(players[i].rolls).done) return i
  }
  return -1
}

/**
 * A computer bowler's throw. On a full rack it plays the pocket from the right with a hook; on a spare it rolls
 * straight at the middle of what is left. `skill` (0-1) narrows its misses.
 */
export function botThrow(standing: readonly boolean[] | null, random: () => number = Math.random, skill = 0.6): Throw {
  const noise = (s: number) => (random() - 0.5) * 2 * s * (1.4 - skill)
  const left = standing ? PIN_X.filter((_, i) => standing[i]) : PIN_X
  if (!standing || left.length === 10) {
    return { x: 0.3 + noise(0.06), angle: noise(0.006), speed: 7.8 + noise(0.6), hook: 9 + noise(2) }
  }
  const target = left.reduce((s, x) => s + x, 0) / Math.max(1, left.length)
  return { x: Math.max(-STANCE, Math.min(STANCE, target + noise(0.05))), angle: noise(0.004), speed: 8.5 + noise(0.5), hook: 0 }
}

// The phone swing detector is shared with the other gyro games (badminton).
export { createSwing } from '../../../controller/swing'

/** Mouse or finger: a flick up the screen. dy is how fast it moved up (px/s), dx how far it drifted sideways (px). */
export function flickThrow(x: number, dyPerSec: number, dx: number, height: number, hook: number): Throw | null {
  if (dyPerSec < 250) return null
  const k = Math.max(0, Math.min(1, (dyPerSec - 300) / 2400))
  return {
    x: Math.max(-STANCE, Math.min(STANCE, x)),
    angle: Math.max(-0.05, Math.min(0.05, (dx / Math.max(1, height)) * 0.12)),
    speed: SPEED.min + k * (SPEED.max - SPEED.min),
    hook,
  }
}
