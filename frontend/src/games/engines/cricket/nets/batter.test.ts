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
function play(kmh: number, elevation: number, line: number, input: (t: number) => { x: number; y: number }): Run {
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

  it('faster bowling still meets the bat', () => {
    for (const [kmh, el] of [
      [100, -6],
      [125, -8],
    ]) {
      expect(play(kmh, el, 0, still).contact).toBeGreaterThan(0)
    }
  })
})
