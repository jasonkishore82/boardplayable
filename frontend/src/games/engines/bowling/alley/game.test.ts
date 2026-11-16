import { describe, expect, it } from 'vitest'
import { SPEED, applyBall, botThrow, createSwing, flickThrow, nextPlayer, type Player } from './game'

const p = (name: string, rolls: number[] = [], bot = false): Player => ({ name, bot, rolls })

describe('bowling turns', () => {
  it('ends the frame on a strike, keeps it open after a first ball', () => {
    expect(applyBall([], 10)).toMatchObject({ frameOver: true, fullRack: true, wasFullRack: true })
    expect(applyBall([], 7)).toMatchObject({ frameOver: false, fullRack: false, standingBefore: 10 })
    expect(applyBall([7], 3)).toMatchObject({ frameOver: true, standingBefore: 3, wasFullRack: false })
  })

  it('never counts more pins than were standing', () => {
    expect(applyBall([7], 9).rolls).toEqual([7, 3])
  })

  it('gives the 10th frame its bonus balls with a fresh rack', () => {
    const nine = Array(18).fill(0)
    expect(applyBall(nine, 10)).toMatchObject({ frameOver: false, fullRack: true })
    expect(applyBall([...nine, 4], 6)).toMatchObject({ frameOver: false, fullRack: true })
    expect(applyBall([...nine, 4, 6], 3)).toMatchObject({ frameOver: true, done: true })
  })

  it('passes the turn round the players who are still bowling', () => {
    const done = Array(20).fill(0)
    const players = [p('A'), p('B', done), p('C')]
    expect(nextPlayer(players, 0)).toBe(2)
    expect(nextPlayer(players, 2)).toBe(0)
    expect(nextPlayer([p('A', done), p('B', done)], 0)).toBe(-1)
  })

  it('has the computer play the pocket, then the spare', () => {
    const full = botThrow(null, () => 0.5)
    expect(full.x).toBeCloseTo(0.3)
    expect(full.hook).toBeGreaterThan(0)
    const tenPin = botThrow([false, false, false, false, false, false, false, false, false, true], () => 0.5)
    expect(tenPin.x).toBeGreaterThan(0.4)
    expect(tenPin.hook).toBe(0)
  })
})

describe('the phone swing', () => {
  it('bowls on a backswing then a forward swing, faster for a sharper swing', () => {
    const s = createSwing()
    const run = (dur: number) => {
      const sw = createSwing()
      let out: number | null = null
      for (let t = 0; t <= 0.3; t += 0.016) sw.sample(0.8, t) // backswing
      for (let t = 0; t <= dur + 0.02; t += 0.016) out = out ?? sw.sample(0.8 - (1.4 * t) / dur, 0.3 + t)
      return out
    }
    expect(s.sample(0, 0)).toBeNull()
    const slow = run(0.8)
    const fast = run(0.15)
    expect(slow).not.toBeNull()
    expect(fast).not.toBeNull()
    expect(fast!).toBeGreaterThan(slow!)
    expect(fast!).toBeLessThanOrEqual(SPEED.max)
    expect(slow!).toBeGreaterThanOrEqual(SPEED.min)
  })

  it('ignores a forward tilt without a backswing, or long after it', () => {
    const s = createSwing()
    for (let t = 0; t < 1; t += 0.016) expect(s.sample(-0.9, t)).toBeNull()
    const late = createSwing()
    late.sample(0.8, 0)
    expect(late.sample(0.2, 0.5)).toBeNull()
    expect(late.sample(-0.9, 1.6)).toBeNull()
  })
})

describe('the mouse flick', () => {
  it('needs a real flick, and turns it into speed and angle', () => {
    expect(flickThrow(0, 100, 0, 800, 0)).toBeNull()
    const soft = flickThrow(0.1, 600, 0, 800, 8)!
    const hard = flickThrow(0.1, 2600, 40, 800, 8)!
    expect(hard.speed).toBeGreaterThan(soft.speed)
    expect(hard.angle).toBeGreaterThan(0)
    expect(soft.hook).toBe(8)
  })
})
