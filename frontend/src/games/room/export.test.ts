import { describe, expect, it } from 'vitest'
import { exportName, historyTable } from './export'

describe('exportName', () => {
  it('makes a safe, dated file name', () => {
    expect(exportName('chess', 'pdf', new Date(2026, 10, 10, 14, 5))).toBe('chess-2026-11-10-1405.pdf')
    expect(exportName('tic-tac-toe', 'png', new Date(2026, 0, 2, 9, 30))).toBe('tic-tac-toe-2026-01-02-0930.png')
    expect(exportName('../evil name', 'png', new Date(2026, 0, 2, 9, 30))).toBe('evilname-2026-01-02-0930.png')
  })
})

describe('historyTable', () => {
  it('returns nothing when no moves were played', () => {
    expect(historyTable('chess', [])).toBeNull()
    expect(historyTable('chess', undefined)).toBeNull()
  })

  it('lays chess out as numbered pairs, with a half pair at the end', () => {
    const table = historyTable('chess', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(table?.header).toEqual(['#', 'White', 'Black'])
    expect(table?.rows).toEqual([
      ['1', 'e4', 'e5'],
      ['2', 'Nf3', 'Nc6'],
      ['3', 'Bb5', ''],
    ])
  })

  it('splits tic-tac-toe moves into player and square', () => {
    const table = historyTable('tic-tac-toe', ['X5', 'O1', 'X9'])
    expect(table?.header).toEqual(['#', 'Player', 'Square'])
    expect(table?.rows).toEqual([
      ['1', 'X', '5'],
      ['2', 'O', '1'],
      ['3', 'X', '9'],
    ])
  })

  it('falls back to a plain list for other games', () => {
    expect(historyTable('snakes-and-ladders', ['rolled 4'])?.rows).toEqual([['1', 'rolled 4']])
  })
})
