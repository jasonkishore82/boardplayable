import { describe, expect, it } from 'vitest'
import { canPlay, myMark, newRoomCode, parseRoomCode, statusLine, type TttState } from './rules'

const ada = { id: 'a', username: 'ada' }
const bo = { id: 'b', username: 'bo' }

function state(over: Partial<TttState> = {}): TttState {
  return {
    board: Array(9).fill(null),
    turn: 'X',
    winner: null,
    line: null,
    round: 1,
    scores: { X: 0, O: 0, draw: 0 },
    seats: { X: ada, O: bo },
    ...over,
  }
}

describe('tic-tac-toe status', () => {
  it('knows who is who', () => {
    expect(myMark(state(), 'a')).toBe('X')
    expect(myMark(state(), 'b')).toBe('O')
    expect(myMark(state(), 'c')).toBeNull()
  })

  it('says whose turn it is', () => {
    expect(statusLine(state(), 'a')).toMatch(/Your turn/)
    expect(statusLine(state(), 'b')).toMatch(/Waiting for ada/)
    expect(statusLine(state(), 'c')).toMatch(/ada’s turn/)
  })

  it('waits for an opponent', () => {
    expect(statusLine(state({ seats: { X: ada, O: null } }), 'a')).toMatch(/Waiting for an opponent/)
  })

  it('reports results', () => {
    expect(statusLine(state({ winner: 'X' }), 'a')).toBe('You won!')
    expect(statusLine(state({ winner: 'X' }), 'b')).toBe('ada won.')
    expect(statusLine(state({ winner: 'draw' }), 'a')).toMatch(/draw/)
  })
})

describe('canPlay', () => {
  it('only on your turn, in an empty square, while the game runs', () => {
    expect(canPlay(state(), 'a', 4)).toBe(true)
    expect(canPlay(state(), 'b', 4)).toBe(false) // not O's turn
    expect(canPlay(state(), 'c', 4)).toBe(false) // spectator
    expect(canPlay(state({ board: ['X', ...Array(8).fill(null)] }), 'a', 0)).toBe(false)
    expect(canPlay(state({ winner: 'X' }), 'a', 4)).toBe(false)
    expect(canPlay(state({ seats: { X: ada, O: null } }), 'a', 4)).toBe(false)
  })
})

describe('room codes', () => {
  it('makes six digits', () => {
    expect(newRoomCode()).toMatch(/^\d{6}$/)
  })

  it('reads a code or a pasted link', () => {
    expect(parseRoomCode(' 048 215 ')).toBe('048215')
    expect(parseRoomCode('https://boardplayable.site/games/tic-tac-toe?room=048215')).toBe('048215')
    expect(parseRoomCode('no')).toBeNull()
    expect(parseRoomCode('12345')).toBeNull()
    expect(parseRoomCode('1234567')).toBeNull()
    expect(parseRoomCode('ab12cd')).toBeNull()
    expect(parseRoomCode('not a code!')).toBeNull()
  })
})
