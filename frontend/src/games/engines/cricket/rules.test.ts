import { describe, expect, it } from 'vitest'
import { describeResult } from '../../room/result'
import { historyTable } from '../../room/export'
import { canPick, chaseLine, innings, lastLine, overs, statusLine, type CricketState } from './rules'

const ada = { id: 'a', username: 'ada' }
const bo = { id: 'b', username: 'bo' }

function state(overrides: Partial<CricketState> = {}): CricketState {
  return {
    first: 'home',
    batting: 'home',
    innings: 1,
    runs: { home: 0, away: 0 },
    wickets: { home: 0, away: 0 },
    balls: { home: 0, away: 0 },
    target: null,
    picked: { home: false, away: false },
    last: null,
    maxWickets: 2,
    maxBalls: 18,
    turn: 'home',
    winner: null,
    reason: null,
    round: 1,
    history: [],
    scores: { home: 0, away: 0, draw: 0 },
    seats: { home: ada, away: bo },
    ...overrides,
  }
}

describe('cricket', () => {
  it('counts overs in sixes', () => {
    expect(overs(0)).toBe('0.0')
    expect(overs(14)).toBe('2.2')
    expect(overs(18)).toBe('3.0')
  })

  it('tells each player their role and lets them pick once per ball', () => {
    expect(statusLine(state(), 'a')).toBe('You’re batting. Pick a number.')
    expect(statusLine(state(), 'b')).toBe('You’re bowling. Pick a number.')
    const picked = state({ picked: { home: true, away: false } })
    expect(canPick(picked, 'a')).toBe(false)
    expect(canPick(picked, 'b')).toBe(true)
    expect(canPick(picked, 'someone-else')).toBe(false)
    expect(statusLine(picked, 'a')).toBe('You’re batting. Waiting for bo…')
  })

  it('waits for an opponent before anyone can pick', () => {
    const alone = state({ seats: { home: ada, away: null } })
    expect(canPick(alone, 'a')).toBe(false)
    expect(statusLine(alone, 'a')).toMatch(/Waiting for an opponent/)
  })

  it('describes the last ball', () => {
    const four = state({ last: { batter: 'home', bat: 4, bowl: 2, runs: 4, out: false } })
    expect(lastLine(four, 'a')).toBe('You played 4, bo bowled 2. 4 runs.')
    const out = state({ last: { batter: 'home', bat: 3, bowl: 3, runs: 0, out: true } })
    expect(lastLine(out, 'b')).toBe('ada played 3 and you bowled 3. Out!')
  })

  it('shows the chase and the innings ball by ball', () => {
    const chase = state({
      innings: 2,
      batting: 'away',
      runs: { home: 12, away: 5 },
      balls: { home: 9, away: 4 },
      target: 13,
      history: ['home 6 v 1: 6 runs', 'home 2 v 2: out', 'away 5 v 1: 5 runs', 'away 1 v 1: out'],
    })
    expect(chaseLine(chase, 'b')).toBe('You need 8 from 14 balls.')
    expect(chaseLine(chase, 'a')).toBe('bo needs 8 from 14 balls.')
    expect(innings(chase, 'home')).toEqual(['6', 'W'])
    expect(innings(chase, 'away')).toEqual(['5', 'W'])
  })

  it('has its own result card and ball-by-ball export', () => {
    const won = state({ winner: 'away', reason: 'chased the target', history: ['home 1 v 1: out', 'away 4 v 2: 4 runs'] })
    expect(describeResult('cricket', won, 'b')).toEqual({
      title: 'You win!',
      detail: 'You won by chasing the target.',
      meta: '2 balls bowled',
      tone: 'win',
    })
    expect(describeResult('cricket', won, 'a')?.tone).toBe('loss')
    expect(describeResult('cricket', state({ winner: 'draw' }), 'a')?.title).toBe('Tie')
    expect(historyTable('cricket', won.history)?.rows[1]).toEqual(['2', 'Away', '4', '2', '4 runs'])
  })
})
