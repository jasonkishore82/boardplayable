import { describe, expect, it } from 'vitest'
import { CATEGORIES, GAMES, formatPlayers, groupByCategory } from './catalog'

describe('catalog', () => {
  it('has unique, URL-safe ids', () => {
    const ids = GAMES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('only uses known categories', () => {
    const known = new Set(CATEGORIES.map((c) => c.id))
    for (const g of GAMES) expect(known.has(g.category)).toBe(true)
  })

  it('groups in category order and drops empty groups', () => {
    const groups = groupByCategory([GAMES[0]])
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe(GAMES[0].category)
  })

  it('formats player counts', () => {
    expect(formatPlayers({ min: 2, max: 2 })).toBe('2 players')
    expect(formatPlayers({ min: 2, max: 6 })).toBe('Up to 6 players')
    expect(formatPlayers(null)).toBe('Varies by game')
  })
})
