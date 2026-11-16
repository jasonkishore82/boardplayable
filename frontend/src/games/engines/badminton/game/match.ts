// A game of singles, run step by step: the serve, both players running to the shuttle, the computer choosing and
// playing its shots, your swings, the shuttle's flight, the calls and the score. Plain logic with no drawing, so the
// arena just shows what is here, and the tests can play whole games.
//
// You only choose when to swing and where to put it: your player runs to meet the shuttle on their own (the way a
// phone-controlled game has to work, with the phone busy being the racket).

import { COURT } from '../badmintoncourt/textures.js'
import { DIFFICULTY, cpuShot, inReach, servePlan, yourShot, type Difficulty, type Kind, type Plan } from './play'
import { award, newGame, rallyWinner, receiveCourt, servePosition, type Score, type Side } from './rules'
import { H, intercept, makeShuttle, sgn, sideOf, solveShot, stepShuttle, type Shuttle, type Vec } from './shuttle'

export type Player = {
  x: number
  z: number
  cpu: boolean
  /** Seconds since the last swing started, for the animation (or a large number). */
  swing: number
  /** Your swing waits this long for the shuttle to come into reach. */
  armedUntil: number
  strength: number
  smash: boolean
  /** Where they are running to, re-planned a few times a second. */
  goal: { x: number; z: number }
  plannedAt: number
  /** The computer has decided to leave this one (it is going out). */
  leaving: boolean
}

export type MatchEvent =
  | { type: 'hit'; side: Side; kind: Kind; speed: number }
  | { type: 'whiff'; side: Side }
  | { type: 'point'; winner: Side; call: 'in' | 'out' | 'net' | 'fault'; landing: { x: number; z: number } }
  | { type: 'over'; winner: Side }

export type Match = {
  score: Score
  phase: 'serve' | 'rally' | 'point' | 'over'
  /** Seconds in this phase. */
  t: number
  clock: number
  shuttle: Shuttle
  lastHitter: Side
  /** When the last shot was played (match clock). */
  hitAt: number
  serving: boolean
  players: [Player, Player]
  difficulty: Difficulty
  /** Where you are aiming in their court: side -1 (left) to 1, depth 0 (net) to 1 (baseline). */
  aim: { side: number; depth: number }
  events: MatchEvent[]
  random: () => number
}

const POINT_PAUSE = 1.7
const CPU_SERVE_WAIT = 1.3
const YOUR_SPEED = 4.8 // your player runs a little faster than a medium computer, to make up for your reactions
const BASE = (side: Side) => ({ x: sgn(side) * 3.7, z: 0 })
const ARMED = 0.22

function player(cpu: boolean): Player {
  return { x: 0, z: 0, cpu, swing: 9, armedUntil: -1, strength: 0.6, smash: false, goal: { x: 0, z: 0 }, plannedAt: -1, leaving: false }
}

export function createMatch({ to = 21, difficulty = 'medium', cpu = [false, true], server = 0, random = Math.random }: { to?: 11 | 21; difficulty?: Difficulty; cpu?: [boolean, boolean]; server?: Side; random?: () => number } = {}): Match {
  const m: Match = {
    score: newGame(to, server),
    phase: 'serve',
    t: 0,
    clock: 0,
    shuttle: makeShuttle({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
    lastHitter: server,
    hitAt: 0,
    serving: true,
    players: [player(cpu[0]), player(cpu[1])],
    difficulty,
    aim: { side: 0, depth: 0.85 },
    events: [],
    random,
  }
  placeForServe(m)
  return m
}

/** Both players to their service courts, the shuttle in the server's hand. */
function placeForServe(m: Match) {
  const s = m.score.server
  const r = (1 - s) as Side
  const sp = servePosition(m.score)
  const { zSign } = receiveCourt(m.score)
  Object.assign(m.players[s], { x: sp.x, z: sp.z, leaving: false, armedUntil: -1 })
  Object.assign(m.players[r], { x: sgn(r) * (COURT.short + 2.0), z: zSign * 0.8, leaving: false, armedUntil: -1 })
  m.players.forEach((p) => (p.goal = { x: p.x, z: p.z }))
  m.shuttle = makeShuttle(handPosition(m, s), { x: 0, y: 0, z: 0 })
  m.serving = true
  m.lastHitter = s
}

const handPosition = (m: Match, side: Side): Vec => ({ x: m.players[side].x - sgn(side) * 0.35, y: 1.0, z: m.players[side].z })

/** A swing from a player (you): serves if it is your serve, otherwise waits a moment for the shuttle to reach you. */
export function swing(m: Match, side: Side, strength = 0.6, smash = false) {
  const p = m.players[side]
  p.swing = 0
  p.strength = strength
  p.smash = smash
  if (m.phase === 'serve' && m.score.server === side) {
    serve(m, m.aim.depth > 0.5)
    return
  }
  if (m.phase === 'rally') p.armedUntil = m.clock + ARMED
}

function serve(m: Match, high: boolean) {
  const s = m.score.server
  const { side, zSign } = receiveCourt(m.score)
  hit(m, s, servePlan(side, zSign, high, m.random))
  m.serving = true
  m.phase = 'rally'
  m.t = 0
}

function hit(m: Match, side: Side, plan: Plan) {
  const shot = solveShot(m.shuttle.p, plan.to, plan.elevation)
  m.shuttle = makeShuttle(m.shuttle.p, shot.v)
  m.lastHitter = side
  m.hitAt = m.clock
  m.serving = false
  m.players[side].swing = 0
  m.players[side].armedUntil = -1
  m.players.forEach((p) => {
    p.plannedAt = -1
    p.leaving = false
  })
  m.events.push({ type: 'hit', side, kind: plan.kind, speed: Math.hypot(shot.v.x, shot.v.y, shot.v.z) })
}

/** Moves the match on by dt seconds. Events since the last call are in m.events (the caller empties it). */
export function step(m: Match, dt: number) {
  const n = Math.max(1, Math.ceil(dt / H))
  for (let i = 0; i < n; i++) tick(m, dt / n)
}

function tick(m: Match, h: number) {
  m.clock += h
  m.t += h
  m.players.forEach((p) => (p.swing += h))
  if (m.phase === 'over') return

  if (m.phase === 'point') {
    if (m.t > POINT_PAUSE) {
      if (m.score.winner !== null) {
        m.phase = 'over'
        m.events.push({ type: 'over', winner: m.score.winner })
      } else {
        m.phase = 'serve'
        m.t = 0
        placeForServe(m)
      }
    }
    return
  }

  if (m.phase === 'serve') {
    m.shuttle.p = handPosition(m, m.score.server)
    const server = m.players[m.score.server]
    if (server.cpu && m.t > CPU_SERVE_WAIT) serve(m, m.random() < 0.5)
    return
  }

  // ---- the rally ----
  for (const side of [0, 1] as const) {
    // read the shuttle afresh for each player: the first may just have hit it, and the second must plan for the shot
    // that is coming, not the one that was
    const sh = m.shuttle
    const p = m.players[side]
    const coming = m.lastHitter !== side
    // the computer reads your shot only after a moment; you get no such wait (your reactions are your own)
    const waiting = p.cpu && coming && m.clock - m.hitAt < DIFFICULTY[m.difficulty].react
    if (!waiting && m.clock - p.plannedAt > 0.12) {
      p.plannedAt = m.clock
      if (coming) {
        const i = intercept(sh, side, p.cpu ? 2.3 : 2.2)
        // stand a little behind where it comes down, so it drops in front of the racket
        p.goal = { x: i.at.x + sgn(side) * 0.3, z: i.at.z * 0.92 }
        if (p.cpu && !i.landsIn && !p.leaving && m.random() < DIFFICULTY[m.difficulty].letGo) p.leaving = true
      } else p.goal = BASE(side)
    }
    // run there
    const speed = p.cpu ? DIFFICULTY[m.difficulty].speed : YOUR_SPEED
    const dx = p.goal.x - p.x
    const dz = p.goal.z - p.z
    const d = Math.hypot(dx, dz)
    if (d > 1e-3) {
      const k = Math.min(1, (speed * h) / d)
      p.x += dx * k
      p.z += dz * k
    }
    // never across the net
    p.x = sgn(side) * Math.max(0.4, Math.abs(p.x))
    if (!coming || sideOf(sh.p.x) !== side || !inReach(p, sh.p)) continue
    if (p.cpu) {
      // the computer takes it as it comes down into its hitting zone (or a smash on the way)
      if (p.leaving) continue
      const ready = sh.v.y < 0 || sh.p.y < 1.2 || Math.abs(sh.v.x) > 9
      if (ready) hit(m, side, cpuShot(side, m.players[1 - side], sh.p.y, m.difficulty, m.random))
    } else if (p.armedUntil >= m.clock) {
      hit(m, side, yourShot(side, m.aim, p.strength, sh.p.y, p.smash))
    }
  }
  // a swing that found nothing
  for (const side of [0, 1] as const) {
    const p = m.players[side]
    if (p.armedUntil >= 0 && p.armedUntil < m.clock) {
      p.armedUntil = -1
      m.events.push({ type: 'whiff', side })
    }
  }

  const sh = m.shuttle
  stepShuttle(sh, h)
  if (sh.landed) {
    const r = rallyWinner(m.score, sh.p, m.lastHitter, m.serving, sh.netted)
    m.score = award(m.score, r.winner)
    m.phase = 'point'
    m.t = 0
    m.events.push({ type: 'point', winner: r.winner, call: r.call, landing: { x: sh.p.x, z: sh.p.z } })
  }
}
