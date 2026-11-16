// What each player does with the shuttle: where your aim and swing send it, and how the computer picks its shots.
// Pure logic, so it can be tested.

import { SWING } from '../../../controller/swing'
import { COURT } from '../badmintoncourt/textures.js'
import { sgn, type Vec } from './shuttle'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Kind = 'clear' | 'drop' | 'smash' | 'serve'
export type Plan = { to: { x: number; z: number }; elevation: number; kind: Kind }

export const DIFFICULTY: Record<Difficulty, { name: string; speed: number; react: number; miss: number; spread: number; smash: number; letGo: number }> = {
  // speed: how fast it runs (m/s); react: how long before it moves for your shot (s); miss: chance a shot goes
  // astray; spread: how far it lands from where it meant; smash: chance it smashes a high shuttle; letGo: chance it
  // rightly leaves one going out
  easy: { name: 'Easy', speed: 3.0, react: 0.35, miss: 0.12, spread: 0.7, smash: 0.1, letGo: 0.4 },
  medium: { name: 'Medium', speed: 3.7, react: 0.25, miss: 0.06, spread: 0.45, smash: 0.35, letGo: 0.75 },
  hard: { name: 'Hard', speed: 4.4, react: 0.15, miss: 0.025, spread: 0.3, smash: 0.65, letGo: 0.95 },
}

/** How far a player can reach from where they stand: across, and up and down (m). */
export const REACH = { across: 1.15, low: 0.15, high: 2.95 }

const clampZ = (z: number) => Math.max(-COURT.S2 + 0.3, Math.min(COURT.S2 - 0.3, z))

/** Can a player standing at `at` reach a shuttle at `p`? */
export const inReach = (at: { x: number; z: number }, p: Vec) => Math.hypot(p.x - at.x, p.z - at.z) <= REACH.across && p.y >= REACH.low && p.y <= REACH.high

/**
 * Your shot. aim.side runs across their court (-1 to 1, as you look at it: -1 left), aim.depth from the net (0) to
 * their baseline (1). strength (0-1) is how hard you swung: a soft swing drops it short whatever the aim, a hard
 * one from up high is a smash. `smash` forces one when the shuttle is high enough.
 */
export function yourShot(side: 0 | 1, aim: { side: number; depth: number }, strength: number, contactY: number, smash = false): Plan {
  const them = sgn((1 - side) as 0 | 1)
  // as you face the net, your left is -z for side 0 (facing +x) and +z for side 1
  const left = side === 0 ? -1 : 1
  const z = clampZ(-left * aim.side * (COURT.S2 - 0.3))
  if ((smash || strength > 0.85) && contactY > 2.0) {
    return { to: { x: them * (2.6 + aim.depth * 2.2), z }, elevation: -14, kind: 'smash' }
  }
  if (strength < 0.3 || aim.depth < 0.3) {
    return { to: { x: them * (0.7 + Math.min(aim.depth, 0.3) * 3), z }, elevation: 4, kind: 'drop' }
  }
  return { to: { x: them * (2.8 + aim.depth * (COURT.L2 - 3.3)), z }, elevation: 36, kind: 'clear' }
}

/** A swing's speed from the shared swing detector (5 to 10.5) as a strength from 0 to 1. */
export const strengthOf = (swingSpeed: number) => Math.max(0, Math.min(1, (swingSpeed - SWING.min) / (SWING.max - SWING.min)))

/**
 * The computer's shot: away from where you are standing, deep or short, smashing a high one now and then. Sometimes
 * (more often on easy) it goes astray: long, wide or into the net.
 */
export function cpuShot(side: 0 | 1, you: { x: number; z: number }, contactY: number, difficulty: Difficulty, random: () => number = Math.random): Plan {
  const d = DIFFICULTY[difficulty]
  const them = sgn((1 - side) as 0 | 1)
  // aim for the side of the court you are not on
  const away = you.z > 0.3 ? -1 : you.z < -0.3 ? 1 : random() < 0.5 ? -1 : 1
  const jitter = () => (random() - 0.5) * 2 * d.spread
  let plan: Plan
  const youDeep = Math.abs(you.x) > COURT.L2 - 2.2
  if (contactY > 2.2 && random() < d.smash) plan = { to: { x: them * (3 + random() * 2), z: away * (1.4 + random()) }, elevation: -14, kind: 'smash' }
  else if (youDeep && random() < 0.6) plan = { to: { x: them * (0.8 + random() * 1.0), z: away * (0.8 + random() * 1.3) }, elevation: 4, kind: 'drop' }
  else plan = { to: { x: them * (COURT.L2 - 0.6 - random() * 1.2), z: away * (1 + random() * 1.3) }, elevation: 36, kind: 'clear' }
  plan.to = { x: plan.to.x + them * jitter() * 0.6, z: clampZ(plan.to.z + jitter()) }
  if (random() < d.miss) {
    // astray: long, wide, or short into the net
    const k = random()
    if (k < 0.4) plan.to.x = them * (COURT.L2 + 0.4 + random() * 0.8)
    else if (k < 0.75) plan.to.z = Math.sign(plan.to.z || 1) * (COURT.S2 + 0.3 + random() * 0.6)
    else plan = { ...plan, to: { x: them * 0.3, z: plan.to.z }, elevation: -20, kind: 'drop' }
  }
  return plan
}

/** The serve: low and short just past the short service line, or high to the back of the court. */
export function servePlan(receiver: 0 | 1, zSign: number, high: boolean, random: () => number = Math.random): Plan {
  const s = sgn(receiver)
  return high
    ? { to: { x: s * (COURT.L2 - 0.5 - random() * 0.3), z: zSign * (1.0 + random() * 0.9) }, elevation: 45, kind: 'serve' }
    : { to: { x: s * (COURT.short + 0.35 + random() * 0.2), z: zSign * (0.6 + random() * 0.8) }, elevation: 8, kind: 'serve' }
}
