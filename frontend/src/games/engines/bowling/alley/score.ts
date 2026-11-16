// Ten-pin scoring. A game is just the list of how many pins each ball knocked down; everything else (the marks on the
// scorecard, the running totals, which frame and ball comes next, whether the next ball faces a fresh rack) is
// worked out from that list.
//
//   strike  all ten with the first ball of a frame: 10 plus the next two balls
//   spare   all ten with two balls: 10 plus the next ball
//   10th    a strike or spare there earns the bonus balls in the frame itself (up to three balls)

export type FrameView = {
  /** What the scorecard shows in each box: "X", "/", "-", or a digit. The 10th frame has up to three. */
  marks: string[]
  /** The running total after this frame, once its bonus balls are known. */
  total: number | null
}

export type GameView = {
  frames: FrameView[]
  /** Points so far, counting frames whose bonus is still to come as far as they go. */
  total: number
  /** All ten frames are finished. */
  done: boolean
  /** The frame being bowled (0-9), or 10 once done. */
  frame: number
  /** The ball within that frame (0, 1, or 2 in the 10th). */
  ball: number
  /** How many pins stand for the next ball. */
  standing: number
  /** The next ball faces a fresh rack of ten. */
  fullRack: boolean
}

const mark = (pins: number, before: number, prev: number | null): string => {
  if (prev === null && pins === 10 && before === 10) return 'X'
  if (prev !== null && prev + pins === 10 && before < 10) return '/'
  if (pins === 0) return '-'
  return String(pins)
}

export function scoreGame(rolls: readonly number[]): GameView {
  const frames: FrameView[] = []
  let i = 0
  let running = 0
  let total = 0

  for (let f = 0; f < 10; f++) {
    const marks: string[] = []
    let frameTotal: number | null = null
    if (i >= rolls.length) {
      frames.push({ marks, total: null })
      continue
    }
    if (f < 9) {
      const a = rolls[i]
      if (a === 10) {
        marks.push('X')
        const bonus = rolls.slice(i + 1, i + 3)
        total += 10 + bonus.reduce((s, x) => s + x, 0)
        if (bonus.length === 2) frameTotal = running += 10 + bonus[0] + bonus[1]
        i += 1
      } else {
        marks.push(mark(a, 10, null))
        if (i + 1 < rolls.length) {
          const b = rolls[i + 1]
          marks.push(mark(b, 10 - a, a))
          if (a + b === 10) {
            const bonus = rolls[i + 2]
            total += 10 + (bonus ?? 0)
            if (bonus !== undefined) frameTotal = running += 10 + bonus
          } else {
            total += a + b
            frameTotal = running += a + b
          }
          i += 2
        } else {
          total += a
          i += 1
        }
      }
    } else {
      // the 10th: up to three balls, the rack reset after a strike or a spare
      let standing = 10
      let prev: number | null = null
      const tenth = rolls.slice(i, i + 3)
      for (const pins of tenth) {
        const m = mark(pins, standing, prev)
        marks.push(m)
        standing -= pins
        prev = standing === 0 || m === 'X' || m === '/' ? null : pins
        if (standing === 0) standing = 10
        total += pins
      }
      const needed = tenth.length >= 2 && tenth[0] + tenth[1] < 10 && tenth[0] !== 10 ? 2 : 3
      if (tenth.length >= needed) frameTotal = running += tenth.reduce((s, x) => s + x, 0)
      i += tenth.length
    }
    frames.push({ marks, total: frameTotal })
  }

  // where the next ball goes
  const next = nextBall(rolls)
  return { frames, total, ...next }
}

function nextBall(rolls: readonly number[]): Pick<GameView, 'done' | 'frame' | 'ball' | 'standing' | 'fullRack'> {
  let i = 0
  for (let f = 0; f < 9; f++) {
    if (i >= rolls.length) return { done: false, frame: f, ball: 0, standing: 10, fullRack: true }
    if (rolls[i] === 10) {
      i += 1
      continue
    }
    if (i + 1 >= rolls.length) return { done: false, frame: f, ball: 1, standing: 10 - rolls[i], fullRack: false }
    i += 2
  }
  const tenth = rolls.slice(i)
  if (tenth.length === 0) return { done: false, frame: 9, ball: 0, standing: 10, fullRack: true }
  if (tenth.length === 1) {
    const a = tenth[0]
    return a === 10 ? { done: false, frame: 9, ball: 1, standing: 10, fullRack: true } : { done: false, frame: 9, ball: 1, standing: 10 - a, fullRack: false }
  }
  if (tenth.length === 2) {
    const [a, b] = tenth
    if (a === 10) return b === 10 ? { done: false, frame: 9, ball: 2, standing: 10, fullRack: true } : { done: false, frame: 9, ball: 2, standing: 10 - b, fullRack: false }
    if (a + b === 10) return { done: false, frame: 9, ball: 2, standing: 10, fullRack: true }
  }
  return { done: true, frame: 10, ball: 0, standing: 10, fullRack: true }
}

/** What to call a ball on the screen: "STRIKE!", "SPARE!", "GUTTER", "9 pins". */
export function callBall(pins: number, standingBefore: number, wasFullRack: boolean): { title: string; tone: 'strike' | 'spare' | 'miss' | 'pins' } {
  if (pins === 10 && wasFullRack) return { title: 'STRIKE!', tone: 'strike' }
  if (pins === standingBefore && !wasFullRack) return { title: 'SPARE!', tone: 'spare' }
  if (pins === 0) return { title: wasFullRack ? 'GUTTER' : 'MISS', tone: 'miss' }
  return { title: `${pins} ${pins === 1 ? 'pin' : 'pins'}`, tone: 'pins' }
}
