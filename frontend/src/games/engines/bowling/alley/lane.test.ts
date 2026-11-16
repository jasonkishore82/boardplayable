import { describe, expect, it } from 'vitest'
import { bowl, createLane, pinsUp, settled, standing, stepLane, sweep, type Lane, type Throw } from './lane'

// Bowls one ball on a full-size lane with the real pin physics, stepped at 1500 Hz like the alley.
function roll(t: Throw, lane: Lane = createLane()) {
  bowl(lane, t)
  const xs: Record<number, number> = {}
  for (let i = 0; i < 1500 * 16 && !settled(lane); i++) {
    stepLane(lane, 1 / 1500)
    for (const z of [12, 3]) if (xs[z] === undefined && lane.ball.pos.z < z) xs[z] = lane.ball.pos.x
  }
  return { lane, down: standing(lane).filter((s) => !s).length, xs }
}

describe('a bowling lane', () => {
  it('racks ten pins', () => {
    const lane = createLane()
    expect(pinsUp(lane)).toBe(10)
    expect(standing(lane).every(Boolean)).toBe(true)
  })

  it('strikes from a straight ball into the 1-3 pocket', () => {
    const r = roll({ x: 0.07, speed: 8 })
    expect(settled(r.lane)).toBe(true)
    expect(r.down).toBe(10)
  })

  it('a ball angled into the gutter knocks nothing down', () => {
    const r = roll({ x: 0.35, angle: 0.03, speed: 8 })
    expect(r.down).toBe(0)
  })

  it('hooks left on the dry back end, not in the oil', () => {
    const r = roll({ x: 0.3, speed: 8, hook: 9 })
    expect(Math.abs(r.xs[12] - 0.3)).toBeLessThan(0.05) // barely moves through the oil
    expect(r.xs[3]).toBeLessThan(0.15) // breaks towards the pocket at the back
    expect(r.down).toBeGreaterThanOrEqual(7)
  })

  it('sweeps fallen pins away and leaves the standing ones for the spare', () => {
    const r = roll({ x: -0.4, speed: 7 })
    const up = sweep(r.lane, false)
    expect(pinsUp(r.lane)).toBe(up.filter(Boolean).length)
    expect(pinsUp(r.lane)).toBe(10 - r.down)
    expect(standing(r.lane).filter(Boolean).length).toBe(10 - r.down)
    sweep(r.lane, true)
    expect(pinsUp(r.lane)).toBe(10)
  })
})
