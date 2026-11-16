import { describe, expect, it } from 'vitest'
import { botMove, buildDeck, callOne, canPlay, catchOne, drawCard, newRound, pass, play, playable, type Card, type OneCardState } from './rules'

// a small deterministic generator so rounds are repeatable
function seeded(seed = 1) {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const seats = [
  { name: 'You', bot: false },
  { name: 'Mila', bot: true },
  { name: 'Theo', bot: true },
]

let nextId = 1000
const card = (kind: Card['kind'], color: number | null): Card => ({ id: nextId++, kind, color })

// a round with chosen hands and top card
function rigged(hands: Card[][], topCard: Card, over: Partial<OneCardState> = {}): OneCardState {
  const s = newRound(seats.slice(0, hands.length), undefined, 1, seeded(3))
  s.players.forEach((p, i) => (p.hand = hands[i]))
  s.discard = [topCard]
  s.color = topCard.color ?? 0
  return { ...s, ...over }
}

describe('the deck', () => {
  it('has 108 cards with the right make-up', () => {
    const d = buildDeck()
    expect(d).toHaveLength(108)
    expect(d.filter((c) => c.kind === '0')).toHaveLength(4)
    expect(d.filter((c) => c.kind === '7')).toHaveLength(8)
    expect(d.filter((c) => c.kind === '+4')).toHaveLength(4)
    expect(new Set(d.map((c) => c.id)).size).toBe(108)
  })
})

describe('dealing', () => {
  it('deals seven each and starts on a number', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = newRound(seats, undefined, 1, seeded(seed))
      expect(s.players.every((p) => p.hand.length === 7)).toBe(true)
      expect(s.draw.length + s.discard.length + 21).toBe(108)
      expect(Number.isNaN(Number(s.discard[0].kind))).toBe(false)
    }
  })
})

describe('playing', () => {
  it('matches colour or value, and wilds always', () => {
    const s = rigged([[], [], []], card('5', 0))
    expect(canPlay(s, card('9', 0))).toBe(true)
    expect(canPlay(s, card('5', 3))).toBe(true)
    expect(canPlay(s, card('6', 3))).toBe(false)
    expect(canPlay(s, card('wild', null))).toBe(true)
  })

  it('moves the card and passes the turn', () => {
    const c = card('9', 0)
    const s = play(rigged([[c, card('1', 1)], [card('2', 2)], [card('3', 3)]], card('5', 0)), c.id)
    expect(s.discard.at(-1)).toBe(c)
    expect(s.players[0].hand).toHaveLength(1)
    expect(s.turn).toBe(1)
  })

  it('ignores cards that do not fit or are out of turn', () => {
    const bad = card('6', 3)
    const s = rigged([[bad, card('1', 1)], [card('5', 1)], [card('3', 3)]], card('5', 0))
    expect(play(s, bad.id)).toBe(s)
    expect(play(s, s.players[1].hand[0].id)).toBe(s)
  })

  it('skips, reverses and makes the next player draw', () => {
    const hands = () => [[card('skip', 0), card('reverse', 0), card('+2', 0), card('+4', null), card('1', 1)], [card('2', 2)], [card('3', 3)]]
    let h = hands()
    expect(play(rigged(h, card('5', 0)), h[0][0].id).turn).toBe(2)
    h = hands()
    const rev = play(rigged(h, card('5', 0)), h[0][1].id)
    expect(rev.dir).toBe(-1)
    expect(rev.turn).toBe(2)
    h = hands()
    const two = play(rigged(h, card('5', 0)), h[0][2].id)
    expect(two.players[1].hand).toHaveLength(3)
    expect(two.turn).toBe(2)
    h = hands()
    const four = play(rigged(h, card('5', 0)), h[0][3].id, 3)
    expect(four.players[1].hand).toHaveLength(5)
    expect(four.color).toBe(3)
    expect(four.turn).toBe(2)
  })

  it('treats reverse as a skip with two players', () => {
    const h = [[card('reverse', 0), card('1', 1)], [card('2', 2)]]
    expect(play(rigged(h, card('5', 0)), h[0][0].id).turn).toBe(0)
  })

  it('ends the round and scores the other hands', () => {
    const last = card('5', 0)
    const s = play(rigged([[last], [card('9', 2), card('wild', null)], [card('skip', 3)]], card('5', 1)), last.id)
    expect(s.winner).toBe(0)
    expect(s.scores[0]).toBe(9 + 50 + 20)
  })
})

describe('drawing', () => {
  it('lets you play a drawn card that fits, or keep it', () => {
    const s = rigged([[card('1', 1)], [card('2', 2)], [card('3', 3)]], card('5', 0))
    s.draw.push(card('8', 0))
    const d = drawCard(s)
    expect(d.turn).toBe(0)
    expect(d.drawn).not.toBeNull()
    expect(playable(d).map((c) => c.id)).toEqual([d.drawn])
    expect(pass(d).turn).toBe(1)
    expect(play(d, d.drawn!).discard.at(-1)!.kind).toBe('8')
  })

  it('passes straight on when the drawn card does not fit', () => {
    const s = rigged([[card('1', 1)], [card('2', 2)], [card('3', 3)]], card('5', 0))
    s.draw.push(card('8', 2))
    const d = drawCard(s)
    expect(d.turn).toBe(1)
    expect(d.players[0].hand).toHaveLength(2)
  })

  it('reshuffles the discards when the pile runs out', () => {
    const s = rigged([[card('1', 1)], [card('2', 2)], [card('3', 3)]], card('5', 0))
    s.draw = []
    s.discard = [card('7', 1), card('7', 2), card('5', 0)]
    const d = drawCard(s)
    expect(d.discard).toHaveLength(1)
    expect(d.discard[0].kind).toBe('5')
    expect(d.players[0].hand.length + d.draw.length).toBe(3)
  })
})

describe('calling One', () => {
  it('can be caught when you forget', () => {
    const c = card('9', 0)
    const s = play(rigged([[c, card('1', 1)], [card('2', 2)], [card('3', 3)]], card('5', 0)), c.id)
    expect(s.uncalled).toBe(0)
    const caught = catchOne(s, 1)
    expect(caught.players[0].hand).toHaveLength(3)
    expect(caught.uncalled).toBeNull()
  })

  it('is safe once called', () => {
    const c = card('9', 0)
    const s = callOne(rigged([[c, card('1', 1)], [card('2', 2)], [card('3', 3)]], card('5', 0)), 0)
    const after = play(s, c.id)
    expect(after.uncalled).toBeNull()
    expect(catchOne(after, 1)).toBe(after)
  })
})

describe('bots', () => {
  it('always make a legal move, and a whole game finishes', () => {
    for (let seed = 1; seed < 40; seed++) {
      const rng = seeded(seed)
      let s = newRound(seats.map((p) => ({ ...p, bot: true })), undefined, 1, rng)
      let moves = 0
      while (s.winner === null && moves < 2000) {
        const m = botMove(s, rng)
        const before = s
        if (m.type === 'play') s = play(s, m.card, m.color, rng)
        else if (m.type === 'draw') s = drawCard(s, rng)
        else s = pass(s)
        if (s === before) s = drawCard(s, rng) // a stuck pile: nothing to draw
        if (s === before) s = pass({ ...s, drawn: -1 })
        moves++
        const total = s.draw.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0)
        expect(total).toBe(108)
      }
      expect(s.winner).not.toBeNull()
    }
  })
})
