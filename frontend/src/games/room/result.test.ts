import { describe, expect, it } from 'vitest'
import { describeResult } from './result'

const seats = {
  white: { id: 'a', username: 'ada' },
  black: { id: 'b', username: 'Medium Bot' },
}

const game = (over: Record<string, unknown> = {}) => ({ seats, winner: null as string | null, reason: null, history: [] as string[], ...over })

describe('describeResult', () => {
  it('says nothing while the game is still on', () => {
    expect(describeResult('chess', game(), 'a')).toBeNull()
  })

  it('announces checkmate to the winner', () => {
    const r = describeResult('chess', game({ winner: 'white', reason: 'checkmate', history: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'] }), 'a')
    expect(r).toEqual({ title: 'Checkmate', detail: 'You win as White.', meta: '4 moves played', tone: 'win' })
  })

  it('announces checkmate to the loser, by name', () => {
    const r = describeResult('chess', game({ winner: 'black', reason: 'checkmate', history: ['f3', 'e5', 'g4', 'Qh4#'] }), 'a')
    expect(r?.title).toBe('Checkmate')
    expect(r?.detail).toBe('Medium Bot wins as Black.')
    expect(r?.tone).toBe('loss')
  })

  it('tells a spectator who won without taking a side', () => {
    const r = describeResult('chess', game({ winner: 'white', reason: 'checkmate' }), 'someone-else')
    expect(r).toMatchObject({ title: 'Checkmate', detail: 'ada wins as White.', tone: 'neutral', meta: null })
  })

  it('handles stalemate and other draws', () => {
    expect(describeResult('chess', game({ winner: 'draw', reason: 'stalemate' }), 'a')).toMatchObject({ title: 'Stalemate', tone: 'draw' })
    expect(describeResult('chess', game({ winner: 'draw', reason: 'insufficient material' }), 'a')).toMatchObject({
      title: 'Draw',
      detail: 'Drawn by insufficient material.',
    })
    expect(describeResult('tic-tac-toe', game({ winner: 'draw', reason: undefined }), 'a')?.detail).toBe('The game is a draw.')
  })

  it('words a resignation for each person', () => {
    const resigned = (id: string) => describeResult('chess', game({ winner: 'black', reason: 'resignation' }), id)
    expect(resigned('b')?.detail).toBe('Your opponent resigned.')
    expect(resigned('a')?.detail).toBe('You resigned. Medium Bot wins.')
    expect(resigned('x')?.detail).toBe('Medium Bot wins by resignation.')
  })

  it('works for games with no reason, like tic-tac-toe', () => {
    const ttt = { seats: { X: { id: 'a', username: 'ada' }, O: { id: 'b', username: 'bo' } }, winner: 'X', history: ['X5', 'O1', 'X1'] }
    expect(describeResult('tic-tac-toe', ttt, 'a')).toMatchObject({ title: 'You win!', detail: 'You win as X.', meta: '3 moves played' })
    expect(describeResult('tic-tac-toe', ttt, 'b')).toMatchObject({ title: 'You lose', tone: 'loss' })
    expect(describeResult('tic-tac-toe', ttt, 'x')).toMatchObject({ title: 'Game over', tone: 'neutral' })
  })

  it('counts one move for a single move', () => {
    expect(describeResult('chess', game({ winner: 'white', reason: 'checkmate', history: ['Qh7#'] }), 'a')?.meta).toBe('1 move played')
  })
})
