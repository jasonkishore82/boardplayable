// The shuttlecock in flight, and the shots that send it where a player wants it.
//
// A shuttle is all drag: its feathered skirt gives it a terminal speed of only about 6.8 m/s, so a 90 m/s smash
// has lost most of its pace before it crosses the net, and a high clear falls almost straight down at the back. The
// force is gravity plus quadratic drag, a = g - (g / vt²)|v|v, stepped at 240 Hz.
//
// World frame (the court's, see badmintoncourt/textures.js): the court runs along x with the net at x = 0; side 0
// (you) plays from x < 0, side 1 (the computer) from x > 0. +y is up, the floor at y = 0.

import { COURT } from '../badmintoncourt/textures.js'

export type Vec = { x: number; y: number; z: number }
export type Shuttle = { p: Vec; v: Vec; netted: boolean; landed: boolean }

export const G = 9.81
export const VT = 6.8 // terminal velocity, m/s
const K = G / (VT * VT)
export const H = 1 / 240
export const NET_TOP = COURT.netCentre // 1.524 m (1.55 at the posts)

/** Which half of the court a point is in: 0 for x < 0, 1 for x > 0. */
export const sideOf = (x: number): 0 | 1 => (x < 0 ? 0 : 1)
/** The sign of a side's half: -1 for side 0, +1 for side 1. */
export const sgn = (side: 0 | 1) => (side === 0 ? -1 : 1)

/** Is a landing spot inside the singles court? */
export const inSingles = (x: number, z: number) => Math.abs(x) <= COURT.L2 && Math.abs(z) <= COURT.S2

export function makeShuttle(p: Vec, v: Vec): Shuttle {
  return { p: { ...p }, v: { ...v }, netted: false, landed: false }
}

/** The net's top along its length: 1.524 m in the middle up to 1.55 m at the posts. */
function netTop(z: number) {
  const u = Math.min(1, Math.abs(z) / COURT.W2)
  return COURT.netCentre + (COURT.netPost - COURT.netCentre) * u
}

/** One step of h seconds. Stops the shuttle on the floor; drops it off the net if it hits the net. */
export function stepShuttle(s: Shuttle, h = H) {
  if (s.landed) return
  const { p, v } = s
  const sp = Math.hypot(v.x, v.y, v.z)
  // drag, half-implicit so a fast smash cannot overshoot and reverse
  const d = 1 / (1 + K * sp * h)
  v.x *= d
  v.z *= d
  v.y = (v.y - G * h) * d
  const x0 = p.x
  p.x += v.x * h
  p.y += v.y * h
  p.z += v.z * h
  // the net: crossing x = 0 below its top (and inside the posts) stops it dead and it drops
  if (!s.netted && Math.sign(x0) !== Math.sign(p.x) && x0 !== 0 && Math.abs(p.z) < COURT.W2 && p.y < netTop(p.z)) {
    s.netted = true
    p.x = Math.sign(x0) * 0.03
    v.x *= -0.08
    v.z *= 0.3
    v.y = Math.min(v.y, 0)
  }
  if (p.y <= 0) {
    p.y = 0
    s.landed = true
  }
}

/** Flies a copy of a shuttle until it lands (or `maxT` passes), calling `each` after every step; returns the copy. */
export function fly(start: Shuttle, each?: (s: Shuttle, t: number) => boolean | void, maxT = 6): Shuttle {
  const s = makeShuttle(start.p, start.v)
  s.netted = start.netted
  for (let t = 0; t < maxT && !s.landed; t += H) {
    stepShuttle(s)
    if (each && each(s, t + H)) break
  }
  return s
}

export type Shot = { v: Vec; elevation: number; clears: boolean }

/**
 * The launch that sends a shuttle from `from` to land at `to` (on the floor), leaving at `elevation` degrees or
 * steeper if it has to be to clear the net. Finds the speed by bisection (range rises with speed at any one angle).
 */
export function solveShot(from: Vec, to: { x: number; z: number }, elevation: number, maxSpeed = 90): Shot {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const dist = Math.hypot(dx, dz)
  const ux = dx / (dist || 1)
  const uz = dz / (dist || 1)
  let best: Shot | null = null
  let bestMiss = Infinity
  for (let e = elevation; e <= 80; e += 4) {
    const c = Math.cos((e * Math.PI) / 180)
    const sn = Math.sin((e * Math.PI) / 180)
    const shot = (speed: number) => {
      let clears = true
      const s = fly(makeShuttle(from, { x: ux * c * speed, y: sn * speed, z: uz * c * speed }), (q) => {
        if (q.netted) clears = false
      })
      const r = (s.p.x - from.x) * ux + (s.p.z - from.z) * uz
      return { r, clears }
    }
    let lo = 1
    let hi = maxSpeed
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2
      if (shot(mid).r < dist) lo = mid
      else hi = mid
    }
    const speed = (lo + hi) / 2
    const { r, clears } = shot(speed)
    const v = { x: ux * c * speed, y: sn * speed, z: uz * c * speed }
    const miss = Math.abs(r - dist)
    // At a flat angle a short target can be out of reach: anything slower nets, anything that clears flies past. The
    // search then stops on that jump; try a steeper angle instead.
    if (clears && miss < 0.08) return { v, elevation: e, clears }
    if (!best || (clears && (!best.clears || miss < bestMiss))) {
      best = { v, elevation: e, clears }
      bestMiss = miss
    }
  }
  return best!
}

/**
 * Where a player on `side` should meet the shuttle: the first point, once it is over their half and coming down,
 * where it drops below `height`, or failing that where it lands. Also says when, and whether it would land in.
 */
export function intercept(s: Shuttle, side: 0 | 1, height = 2.2): { at: Vec; t: number; landsIn: boolean; landing: Vec } {
  let at: Vec | null = null
  let tAt = 0
  const end = fly(s, (q, t) => {
    if (!at && sideOf(q.p.x) === side && Math.abs(q.p.x) > 0.3 && q.v.y < 0 && q.p.y < height) {
      at = { ...q.p }
      tAt = t
    }
  })
  return { at: at ?? { ...end.p }, t: at ? tAt : 6, landsIn: inSingles(end.p.x, end.p.z) && sideOf(end.p.x) === side, landing: { ...end.p } }
}
