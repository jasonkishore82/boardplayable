import { describe, expect, it } from 'vitest'
import { lostPieces } from './rules'

const START: Record<string, string> = {}
for (const [rank, row] of [
  ['1', 'RNBQKBNR'],
  ['2', 'PPPPPPPP'],
  ['7', 'pppppppp'],
  ['8', 'rnbqkbnr'],
] as const) {
  ;[...row].forEach((piece, file) => {
    START['abcdefgh'[file] + rank] = piece
  })
}

describe('lostPieces', () => {
  it('is empty at the start', () => {
    expect(lostPieces(START, 'white')).toEqual([])
    expect(lostPieces(START, 'black')).toEqual([])
  })

  it('lists what is missing, strongest first, in the case of that side', () => {
    const board = { ...START }
    delete board.d8 // black queen
    delete board.a7
    delete board.b7
    delete board.g1 // white knight
    expect(lostPieces(board, 'black')).toEqual(['q', 'p', 'p'])
    expect(lostPieces(board, 'white')).toEqual(['N'])
  })

  it('does not count an extra queen from a promotion as a negative loss', () => {
    const board: Record<string, string> = { ...START, a8: 'Q' }
    delete board.a2
    expect(lostPieces(board, 'white')).toEqual(['P'])
  })
})
