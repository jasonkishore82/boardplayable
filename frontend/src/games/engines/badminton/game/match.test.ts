import { describe, expect, it } from 'vitest'
import { createMatch, step, swing } from './match'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('a game of singles', () => {
  it('plays a whole game, computer against computer, to a proper finish', () => {
    const m = createMatch({ to: 21, difficulty: 'medium', cpu: [true, true], random: rng(3) })
    let hits = 0
    let points = 0
    let longest = 0
    let rally = 0
    for (let t = 0; t < 3600 && m.phase !== 'over'; t += 1 / 60) {
      step(m, 1 / 60)
      for (const e of m.events) {
        if (e.type === 'hit') {
          hits++
          rally++
        }
        if (e.type === 'point') {
          points++
          longest = Math.max(longest, rally)
          rally = 0
        }
      }
      m.events.length = 0
    }
    expect(m.phase).toBe('over')
    const [a, b] = m.score.points
    expect(Math.max(a, b)).toBeGreaterThanOrEqual(21)
    expect(Math.abs(a - b) >= 2 || Math.max(a, b) === 30).toBe(true)
    expect(points).toBe(a + b)
    // real rallies, not every point lost on the serve
    expect(hits / points).toBeGreaterThan(2.5)
    expect(longest).toBeGreaterThanOrEqual(6)
  })

  it('lets you serve, and your swing returns a shuttle that reaches you', () => {
    const m = createMatch({ to: 21, difficulty: 'easy', server: 0, random: rng(7) })
    swing(m, 0, 0.6) // the serve
    expect(m.phase).toBe('rally')
    let returned = false
    let yourHits = 0
    // swing whenever the shuttle is on your side and coming down, as a player would
    for (let t = 0; t < 30 && !returned; t += 1 / 60) {
      const s = m.shuttle
      if (m.phase === 'rally' && m.lastHitter === 1 && s.p.x < -1 && s.v.y < 0 && s.p.y < 2.4) swing(m, 0, 0.6)
      step(m, 1 / 60)
      for (const e of m.events) if (e.type === 'hit' && e.side === 0) yourHits++
      m.events.length = 0
      if (yourHits >= 2) returned = true
    }
    expect(returned).toBe(true)
  })

  it('loses you the point if you never swing', () => {
    const m = createMatch({ to: 21, difficulty: 'medium', server: 1, random: rng(11) })
    let point = null
    for (let t = 0; t < 12 && !point; t += 1 / 60) {
      step(m, 1 / 60)
      point = m.events.find((e) => e.type === 'point') ?? null
      m.events.length = 0
    }
    expect(point).toMatchObject({ type: 'point', winner: 1 })
  })
})
