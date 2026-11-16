import { describe, expect, it } from 'vitest'
import { callBall, scoreGame } from './score'

describe('ten-pin scoring', () => {
  it('scores a perfect game as 300', () => {
    const g = scoreGame(Array(12).fill(10))
    expect(g.total).toBe(300)
    expect(g.done).toBe(true)
    expect(g.frames[9].marks).toEqual(['X', 'X', 'X'])
    expect(g.frames.map((f) => f.total)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300])
  })

  it('scores all nines and misses as 90', () => {
    const g = scoreGame(Array(10).fill([9, 0]).flat())
    expect(g.total).toBe(90)
    expect(g.done).toBe(true)
    expect(g.frames[0].marks).toEqual(['9', '-'])
  })

  it('scores all spares of 5 with a 5 bonus as 150', () => {
    const g = scoreGame(Array(21).fill(5))
    expect(g.total).toBe(150)
    expect(g.frames[0].marks).toEqual(['5', '/'])
    expect(g.frames[9].marks).toEqual(['5', '/', '5'])
    expect(g.done).toBe(true)
  })

  it('waits for bonus balls before totalling a strike or spare', () => {
    const g = scoreGame([10, 3])
    expect(g.frames[0].total).toBeNull()
    expect(g.total).toBe(16) // counted as far as it goes
    expect(g.frame).toBe(1)
    expect(g.ball).toBe(1)
    expect(g.standing).toBe(7)
    expect(g.fullRack).toBe(false)
    expect(scoreGame([10, 3, 4]).frames[0].total).toBe(17)
    expect(scoreGame([7, 3]).frames[0].total).toBeNull()
    expect(scoreGame([7, 3, 4]).frames[0].total).toBe(14)
  })

  it('knows the next ball', () => {
    expect(scoreGame([])).toMatchObject({ frame: 0, ball: 0, standing: 10, fullRack: true, done: false })
    expect(scoreGame([10])).toMatchObject({ frame: 1, ball: 0, fullRack: true })
    expect(scoreGame([6])).toMatchObject({ frame: 0, ball: 1, standing: 4, fullRack: false })
  })

  it('plays the 10th frame', () => {
    const nine = Array(18).fill(0)
    expect(scoreGame([...nine, 3, 4])).toMatchObject({ done: true, total: 7 })
    expect(scoreGame([...nine, 3, 7])).toMatchObject({ done: false, frame: 9, ball: 2, fullRack: true })
    expect(scoreGame([...nine, 10])).toMatchObject({ frame: 9, ball: 1, fullRack: true })
    expect(scoreGame([...nine, 10, 4])).toMatchObject({ frame: 9, ball: 2, standing: 6, fullRack: false })
    const g = scoreGame([...nine, 10, 4, 6])
    expect(g).toMatchObject({ done: true, total: 20 })
    expect(g.frames[9].marks).toEqual(['X', '4', '/'])
  })

  it('names each ball', () => {
    expect(callBall(10, 10, true).title).toBe('STRIKE!')
    expect(callBall(3, 3, false).title).toBe('SPARE!')
    expect(callBall(0, 10, true).title).toBe('GUTTER')
    expect(callBall(7, 10, true).title).toBe('7 pins')
  })
})
