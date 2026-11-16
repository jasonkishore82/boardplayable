import { describe, expect, it } from 'vitest'
import { PACES, carry, nextDelivery, overs, region, score } from './shot'

const hit = (vx: number, vy: number, vz = 0, y = 0.4) => score({ kind: 'hit', vx, vy, vz, y }, () => 0.99)

describe('cricket nets scoring', () => {
  it('scores misses, bowled and played on', () => {
    expect(score({ kind: 'missed' })).toMatchObject({ runs: 0, wicket: false, tone: 'dot' })
    expect(score({ kind: 'bowled' })).toMatchObject({ wicket: true, title: 'Bowled!' })
    expect(score({ kind: 'played-on' })).toMatchObject({ wicket: true })
  })

  it('pays more for harder hits along the ground', () => {
    expect(hit(-1, 0.2).runs).toBe(0)
    expect(hit(-5, 0.5).runs).toBe(1)
    expect(hit(-10, 0.5).runs).toBe(2)
    expect(hit(-16, 0.5).runs).toBe(3)
    expect(hit(-24, 0.5)).toMatchObject({ runs: 4, title: 'FOUR!' })
  })

  it('clears the rope when it carries far enough', () => {
    expect(hit(-30, 22)).toMatchObject({ runs: 6, tone: 'boundary' })
  })

  it('can be caught when it hangs in the air', () => {
    const caught = score({ kind: 'hit', vx: -14, vy: 10, vz: 0, y: 0.5 }, () => 0)
    expect(caught).toMatchObject({ wicket: true, title: 'Caught!' })
  })

  it('treats a ball going back past the batter as an edge', () => {
    expect(hit(6, 0.3).title).toBe('Edged')
    expect(hit(12, 0.3).runs).toBe(1)
    expect(hit(9, 4)).toMatchObject({ wicket: true, title: 'Caught behind' })
  })

  it('names where the ball went', () => {
    expect(region(-10, 0)).toBe('straight down the ground')
    expect(region(-10, 10)).toBe('through midwicket')
    expect(region(-10, -10)).toBe('through the covers')
  })

  it('works out carry from launch speed and angle', () => {
    expect(carry(20, 0, 0)).toBe(0)
    expect(carry(20, 10, 0)).toBeCloseTo(20 * ((2 * 10) / 9.81) * 0.8, 5)
  })

  it('sets the machine for each pace', () => {
    for (const p of PACES) {
      const d = nextDelivery(p.id, () => 0.5)
      expect(d.speed).toBe(p.kmh)
      expect(d.elevation).toBeGreaterThanOrEqual(p.elevation[0])
      expect(d.elevation).toBeLessThanOrEqual(p.elevation[1])
      expect(Math.abs(d.line)).toBeLessThanOrEqual(1.1)
    }
  })

  it('counts overs in sixes', () => {
    expect(overs(10)).toBe('1.4')
    expect(overs(12)).toBe('2.0')
  })
})
