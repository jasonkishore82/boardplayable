import { describe, expect, it } from 'vitest'
import { COURT } from '../badmintoncourt/textures.js'
import { award, gameWinner, newGame, rallyWinner, receiveCourt, serveCourt, serveIn, servePosition } from './rules'
import { VT, fly, intercept, makeShuttle, solveShot } from './shuttle'

describe('the shuttle in flight', () => {
  it('falls at its terminal speed of about 6.8 m/s', () => {
    const s = fly(makeShuttle({ x: -3, y: 30, z: 0 }, { x: 0, y: 0, z: 0 }), (_, t) => t > 4)
    expect(-s.v.y).toBeGreaterThan(VT * 0.97)
    expect(-s.v.y).toBeLessThan(VT * 1.01)
  })

  it('loses most of a smash before the far baseline', () => {
    let atNet = 0
    const end = fly(makeShuttle({ x: -4, y: 2.6, z: 0 }, { x: 80, y: -8, z: 0 }), (q) => {
      if (!atNet && q.p.x >= 0) atNet = Math.hypot(q.v.x, q.v.y, q.v.z)
    })
    expect(atNet).toBeGreaterThan(20)
    expect(atNet).toBeLessThan(60)
    expect(end.landed).toBe(true)
  })

  it('stops in the net and drops back on the hitter\'s side', () => {
    const s = fly(makeShuttle({ x: -2, y: 1.0, z: 0 }, { x: 12, y: 0, z: 0 }))
    expect(s.netted).toBe(true)
    expect(s.p.x).toBeLessThan(0)
  })
})

describe('shots', () => {
  const from = { x: -4.5, y: 2.2, z: 0.5 }
  for (const [name, to, e] of [
    ['a clear to the back corner', { x: 6.2, z: -2.2 }, 40],
    ['a drop just over the net', { x: 1.2, z: 1.0 }, 5],
    ['a smash steep into the mid-court', { x: 3.5, z: 0 }, -12],
  ] as const) {
    it(`lands ${name} where it was aimed, over the net`, () => {
      const shot = solveShot(from, to, e)
      expect(shot.clears).toBe(true)
      const end = fly(makeShuttle(from, shot.v))
      expect(end.netted).toBe(false)
      expect(Math.hypot(end.p.x - to.x, end.p.z - to.z)).toBeLessThan(0.15)
    })
  }

  it('lifts a shot that would hit the net', () => {
    const low = { x: -1.5, y: 0.6, z: 0 }
    const shot = solveShot(low, { x: 2, z: 0 }, -5)
    expect(shot.clears).toBe(true)
    expect(shot.elevation).toBeGreaterThan(-5)
  })

  it('predicts where to meet it', () => {
    const shot = solveShot({ x: 4.5, y: 2.2, z: 0 }, { x: -5.5, z: 1.5 }, 40)
    const i = intercept(makeShuttle({ x: 4.5, y: 2.2, z: 0 }, shot.v), 0, 2.2)
    expect(i.at.x).toBeLessThan(-4)
    expect(i.at.y).toBeLessThan(2.25)
    expect(i.landsIn).toBe(true)
    expect(i.t).toBeGreaterThan(0.5)
  })
})

describe('scoring', () => {
  it('wins at 21 with two clear, or at 30', () => {
    expect(gameWinner([21, 19], 21)).toBe(0)
    expect(gameWinner([21, 20], 21)).toBeNull()
    expect(gameWinner([22, 20], 21)).toBe(0)
    expect(gameWinner([29, 30], 21)).toBe(1)
    expect(gameWinner([11, 9], 11)).toBe(0)
    expect(gameWinner([15, 14], 11)).toBe(0)
  })

  it('gives the serve to the rally winner, from the court their score says', () => {
    let g = newGame(21, 0)
    expect(serveCourt(g)).toBe('right')
    g = award(g, 1)
    expect(g.server).toBe(1)
    expect(serveCourt(g)).toBe('left') // 1 point: odd
    g = award(g, 1)
    expect(serveCourt(g)).toBe('right')
  })

  it('serves diagonally', () => {
    const g = newGame(21, 0) // side 0, right court: +z (they face +x)
    expect(servePosition(g).z).toBeGreaterThan(0)
    expect(receiveCourt(g)).toEqual({ side: 1, zSign: -1 })
    expect(serveIn(g, 4, -1)).toBe(true)
    expect(serveIn(g, 4, 1)).toBe(false) // wrong court
    expect(serveIn(g, 1.5, -1)).toBe(false) // short of the short service line
  })

  it('decides rallies', () => {
    const g = newGame(21, 0)
    expect(rallyWinner(g, { x: 3, z: 0.5 }, 0, false, false)).toEqual({ winner: 0, call: 'in' })
    expect(rallyWinner(g, { x: COURT.L2 + 0.3, z: 0 }, 0, false, false)).toEqual({ winner: 1, call: 'out' })
    expect(rallyWinner(g, { x: 3, z: COURT.S2 + 0.1 }, 0, false, false).call).toBe('out')
    expect(rallyWinner(g, { x: -0.2, z: 0 }, 0, false, true)).toEqual({ winner: 1, call: 'net' })
    expect(rallyWinner(g, { x: 4, z: 1 }, 0, true, false)).toEqual({ winner: 1, call: 'fault' })
    expect(rallyWinner(g, { x: -3, z: 0 }, 1, false, false)).toEqual({ winner: 1, call: 'in' })
  })
})

import { cpuShot, inReach, servePlan, yourShot } from './play'
import { serveIn as serveLands } from './rules'

describe('choosing shots', () => {
  it('sends your aim to the matching corner of their court', () => {
    // side 0 faces +x; aim left (-1) is -z as you see it
    const deepLeft = yourShot(0, { side: -1, depth: 1 }, 0.6, 1.8)
    expect(deepLeft.kind).toBe('clear')
    expect(deepLeft.to.x).toBeGreaterThan(COURT.L2 - 1)
    expect(deepLeft.to.z).toBeLessThan(-1.5)
    expect(yourShot(0, { side: 0, depth: 1 }, 0.1, 1.8).kind).toBe('drop')
    expect(yourShot(0, { side: 0, depth: 0.6 }, 0.95, 2.5).kind).toBe('smash')
    expect(yourShot(0, { side: 0, depth: 0.6 }, 0.95, 1.2).kind).toBe('clear') // too low to smash
  })

  it('has the computer play away from you', () => {
    const shot = cpuShot(1, { x: -4, z: 2 }, 1.8, 'hard', () => 0.9)
    expect(shot.to.x).toBeLessThan(0)
    expect(shot.to.z).toBeLessThan(0)
  })

  it('reaches only what is within arm and racket', () => {
    expect(inReach({ x: -4, z: 0 }, { x: -4.5, y: 2, z: 0.6 })).toBe(true)
    expect(inReach({ x: -4, z: 0 }, { x: -2.5, y: 2, z: 0 })).toBe(false)
    expect(inReach({ x: -4, z: 0 }, { x: -4, y: 3.3, z: 0 })).toBe(false)
  })

  it('serves into the right box, low or high', () => {
    const g = newGame(21, 0)
    const { side, zSign } = receiveCourt(g)
    for (const high of [false, true]) {
      const plan = servePlan(side, zSign, high, () => 0.5)
      const from = { ...servePosition(g), y: 1.0 }
      const shot = solveShot({ x: from.x + 0.3, y: 1.0, z: from.z }, plan.to, plan.elevation)
      const end = fly(makeShuttle({ x: from.x + 0.3, y: 1.0, z: from.z }, shot.v))
      expect(end.netted).toBe(false)
      expect(serveLands(g, end.p.x, end.p.z)).toBe(true)
    }
  })
})
