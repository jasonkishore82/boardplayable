import { describe, expect, it } from 'vitest'
import { Euler, Quaternion, Vector3 } from 'three'
import { collideBat, createBatter, stepBatter, swingTarget, STANCE } from './batter'
import { score } from './shot'
import { createBall, stepBall, type BallBody } from './tennisball/physics'

// Flies a delivery the way the bowling machine does (its head 0.95 m up, the ball leaving the mouth along the nose
// with backspin, a cricket ball's drag, lift and bounce) at the batter, both stepped at 600 Hz like the game.

const H = 1 / 600
const CRICKET = { g: 9.81, Cd: 0.45, Cl: 0.28, e0: 0.5, mu: 0.35, crr: 0.06 }
const FLOOR = [{ n: new Vector3(0, 1, 0), d: 0, kind: 'floor' }]

function launch(kmh: number, elevation: number, line: number): BallBody {
  const head = new Quaternion().setFromEuler(new Euler(0, (-line * Math.PI) / 180, (elevation * Math.PI) / 180, 'YZX'))
  const ball = createBall({ r: 0.036, m: 0.16, k: 0.4 })
  ball.p.set(0.24, 0.131, 0).applyQuaternion(head).add(new Vector3(0, 0.95, 0))
  const v = kmh / 3.6
  ball.v.set(1, 0, 0).applyQuaternion(head).multiplyScalar(v)
  ball.w.set(0, 0, 1).applyQuaternion(head).multiplyScalar((v / ball.r) * 0.12)
  return ball
}

type Run = { contact: number; ball: BallBody; exit: { vx: number; vy: number; vz: number; y: number } | null }

/** Bowls one ball; `input(t)` is the bat's control at time t. Runs until the ball is well past the crease or away. */
type Input = { x: number; y: number; q?: [number, number, number, number] }
function play(kmh: number, elevation: number, line: number, input: (t: number) => Input): Run {
  const bat = createBatter()
  const ball = launch(kmh, elevation, line)
  let contact = 0
  let exit: Run['exit'] = null
  for (let t = 0; t < 2.5; t += H) {
    stepBatter(bat, input(t), H)
    stepBall(ball, H, CRICKET, FLOOR)
    const c = collideBat(bat, ball, H)
    if (c) {
      contact = Math.max(contact, c)
      exit = { vx: ball.v.x, vy: ball.v.y, vz: ball.v.z, y: ball.p.y }
    }
    if (ball.p.x > 13 || (exit && t > 0 && ball.p.x < 9)) break
  }
  return { contact, ball, exit }
}

const still = () => ({ x: 0, y: 0 })

describe('the batter in the nets', () => {
  it('rests in the stance and swings both ways', () => {
    expect(swingTarget(0)).toBeCloseTo(STANCE)
    expect(swingTarget(1)).toBeGreaterThan(1.5) // backlift, towards the keeper
    expect(swingTarget(-1)).toBeLessThan(-1.5) // follow-through, towards the bowler
  })

  it('a still, straight bat blocks a straight ball', () => {
    const r = play(70, -4, 0, still)
    expect(r.contact).toBeGreaterThan(5)
    expect(r.exit).not.toBeNull()
    // it comes back off the face towards the bowler, but softly
    expect(r.exit!.vx).toBeLessThan(0)
    expect(Math.hypot(r.exit!.vx, r.exit!.vz)).toBeLessThan(12)
  })

  it('a ball well wide of the bat goes past', () => {
    const r = play(70, -4, 2, still)
    expect(r.contact).toBe(0)
    expect(r.ball.p.x).toBeGreaterThan(12.5)
  })

  it('moving across the crease (phone tilted sideways) reaches a wider ball', () => {
    // at 1.6 degrees the ball passes about 0.31 m from middle: out of reach of a still bat, inside the hands' slide
    for (const line of [1.6, -1.6]) {
      expect(play(70, -4, line, still).contact).toBe(0)
      // a positive line sends the ball to +z, which is the batter's left (screen left from behind): tilt left
      expect(play(70, -4, line, () => ({ x: line > 0 ? -1 : 1, y: 0 })).contact).toBeGreaterThan(0)
      expect(play(70, -4, line, () => ({ x: line > 0 ? 1 : -1, y: 0 })).contact).toBe(0)
    }
  })

  it('a well-timed swing hits far harder than a block', () => {
    const block = play(70, -4, 0, still)
    let best = 0
    let bestOutcome = ''
    // try the downswing starting at different moments, as a player would
    for (let start = 0.2; start < 0.75; start += 0.01) {
      const r = play(70, -4, 0, (t) => ({ x: 0, y: t < start ? 1 : -1 }))
      if (!r.exit || r.exit.vx >= 0) continue
      const vh = Math.hypot(r.exit.vx, r.exit.vz)
      if (vh > best) {
        best = vh
        bestOutcome = score({ kind: 'hit', ...r.exit }, () => 1).title
      }
    }
    const blockSpeed = Math.hypot(block.exit!.vx, block.exit!.vz)
    expect(best).toBeGreaterThan(blockSpeed * 2)
    expect(best).toBeGreaterThan(20) // a boundary
    expect(['FOUR!', 'SIX!']).toContain(bestOutcome)
  })

  describe('moved freely by a phone (input.q)', () => {
    // the phone's turn about one of the bat's own axes (0 x across the face, 1 y up the handle, 2 z out of the back)
    const turn = (axis: 0 | 1 | 2, rad: number): [number, number, number, number] => {
      const v = new Vector3()
      v.setComponent(axis, 1)
      const q = new Quaternion().setFromAxisAngle(v, rad)
      return [q.x, q.y, q.z, q.w]
    }
    const settle = (q: [number, number, number, number]) => {
      const bat = createBatter()
      for (let i = 0; i < 600; i++) stepBatter(bat, { x: 0, y: 0, q }, H)
      return bat
    }
    const toe = (bat: ReturnType<typeof createBatter>) => new Vector3(0, 0, 0).applyQuaternion(bat.quat).add(bat.pos)
    const faceNormal = (bat: ReturnType<typeof createBatter>) => new Vector3(0, 0, -1).applyQuaternion(bat.quat)

    it('a centred phone holds the same stance as the two-axis bat', () => {
      const free = settle(turn(0, 0))
      const two = createBatter()
      for (let i = 0; i < 600; i++) stepBatter(two, still(), H)
      expect(free.quat.angleTo(two.quat)).toBeLessThan(1e-3)
      expect(free.pos.distanceTo(two.pos)).toBeLessThan(1e-3)
    })

    it('turns in every direction, not just the swing', () => {
      const stance = settle(turn(0, 0))
      // tip the top of the handle towards the bowler: the toe goes back towards the keeper (+x), up into the backlift
      const back = settle(turn(0, -1))
      expect(toe(back).x - toe(stance).x).toBeGreaterThan(0.3)
      expect(toe(back).y).toBeGreaterThan(toe(stance).y + 0.2)
      // roll it sideways: the toe swings across the crease
      const across = settle(turn(2, 0.8))
      expect(Math.abs(toe(across).z - toe(stance).z)).toBeGreaterThan(0.4)
      // twist the handle: the face turns, the toe hardly moves
      const twist = settle(turn(1, 0.8))
      expect(toe(twist).distanceTo(toe(stance))).toBeLessThan(0.2)
      expect(faceNormal(twist).angleTo(faceNormal(stance))).toBeGreaterThan(0.7)
    })

    it('the hands move with the swing instead of staying at one spot', () => {
      const stance = settle(turn(0, 0))
      // the backlift takes the hands back towards the keeper
      expect(settle(turn(0, -1.5)).hands.x - stance.hands.x).toBeGreaterThan(0.2)
      // the follow-through takes them forward towards the bowler and up
      const follow = settle(turn(0, 1.9))
      expect(stance.hands.x - follow.hands.x).toBeGreaterThan(0.3)
      expect(follow.hands.y - stance.hands.y).toBeGreaterThan(0.2)
      // rolling the bat across carries the hands across the crease
      expect(Math.abs(settle(turn(2, 0.8)).hands.z)).toBeGreaterThan(0.15)
    })

    it('the toe never digs into the pitch, however the phone is turned', () => {
      for (const axis of [0, 1, 2] as const)
        for (let a = -Math.PI; a <= Math.PI; a += 0.25) expect(toe(settle(turn(axis, a))).y).toBeGreaterThan(0)
    })

    it('a free swing through the line hits far harder than a block', () => {
      const block = play(70, -4, 0, still)
      let best = 0
      // the phone streams its angle as it goes (60 a second), sweeping from the backlift to the follow-through in 0.15 s
      const at = (t: number, start: number) => {
        const k = Math.min(1, Math.max(0, (t - start) / 0.15))
        return turn(0, -1.5 + 3.4 * (Math.floor(k * 9) / 9))
      }
      for (let start = 0.2; start < 0.75; start += 0.01) {
        const r = play(70, -4, 0, (t) => ({ x: 0, y: 0, q: at(t, start) }))
        if (r.exit && r.exit.vx < 0) best = Math.max(best, Math.hypot(r.exit.vx, r.exit.vz))
      }
      expect(best).toBeGreaterThan(Math.hypot(block.exit!.vx, block.exit!.vz) * 2)
    })
  })

  it('the webcam moves the grip to where it sees the hands, with the phone or the mouse', () => {
    const moved = { x: -0.2, y: 0.3, z: -0.4 } // towards the screen, up and to the batter's right
    for (const q of [[0, 0, 0, 1] as [number, number, number, number], undefined]) {
      const rest = createBatter()
      const bat = createBatter()
      for (let i = 0; i < 600; i++) {
        stepBatter(rest, { x: 0, y: 0, q }, H)
        stepBatter(bat, { x: 0, y: 0, q, hands: moved }, H)
      }
      const d = bat.hands.clone().sub(rest.hands)
      expect(d.x).toBeCloseTo(moved.x, 2)
      expect(d.y).toBeCloseTo(moved.y, 2)
      expect(d.z).toBeCloseTo(moved.z, 2)
    }
  })

  it('faster bowling still meets the bat', () => {
    for (const [kmh, el] of [
      [100, -6],
      [125, -8],
    ]) {
      expect(play(kmh, el, 0, still).contact).toBeGreaterThan(0)
    }
  })
})
