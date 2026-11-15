import { describe, expect, it } from 'vitest'
import { isDark, squaresInOrder } from './chess/rules'
import { cellOf, DRAW_ORDER } from './snakes-and-ladders/rules'

describe('chess board', () => {
  it('draws white at the bottom, or black when flipped', () => {
    const white = squaresInOrder(false)
    expect(white).toHaveLength(64)
    expect(white[0]).toBe('a8')
    expect(white[63]).toBe('h1')
    expect(squaresInOrder(true)[0]).toBe('h1')
  })

  it('colours squares like a real board', () => {
    expect(isDark('a1')).toBe(true)
    expect(isDark('h1')).toBe(false)
    expect(isDark('e4')).toBe(false)
  })
})

describe('snakes and ladders board', () => {
  it('zigzags: row one runs left to right, row two right to left', () => {
    expect(cellOf(1)).toEqual({ col: 0, row: 0 })
    expect(cellOf(10)).toEqual({ col: 9, row: 0 })
    expect(cellOf(11)).toEqual({ col: 9, row: 1 })
    expect(cellOf(100)).toEqual({ col: 0, row: 9 })
  })

  it('draws all 100 squares once: 100 at the top left, 1 at the bottom left', () => {
    expect(DRAW_ORDER).toHaveLength(100)
    expect(new Set(DRAW_ORDER).size).toBe(100)
    expect(DRAW_ORDER[0]).toBe(100)
    expect(DRAW_ORDER[90]).toBe(1)
    expect(DRAW_ORDER[99]).toBe(10)
  })
})
