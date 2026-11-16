import * as THREE from 'three'
import { collidePair, laneSurface } from '../pin/physics.js'
import { BALL_R, PIN_COM, RACK, ballBody, pinBody } from '../pin/shape.js'

// One full-size lane's physics: the ten pins, the ball, the lane with its gutters, the kickbacks, the pit and the
// curtain. Plain JS (no React), so the alley scene steps four of these and the tests can bowl on one.
//
// Lane frame (metres): the headpin stands at the origin, the pins rack back along -z, the foul line is 18.29 m up
// the lane at +z (60 ft), +y up. The bowler faces -z, so their right hand is +x and the 1-3 pocket is at +x.
//
// The front of a real lane is oiled and the back end is dry. The ball skids through the oil and only grips (and
// so hooks) in the last few metres, which is what carries it into the pocket at an angle. Here the ball's grip on the
// lane follows that: slick for the first 12 m, then dry.

export const LANE_W = 1.0541
export const GUTTER_R = 0.118
export const PIT_Z = -1.05
export const PIT_DEPTH = 0.25
export const FOUL_Z = 18.29
export const OIL_END_Z = FOUL_Z - 12.2 // 40 ft of oil
const KICKBACK_X = 0.86
const RELEASE_Z = FOUL_Z - 0.3

const MU_OIL = 0.04
const MU_DRY = 0.2

const tiltOf = (q) => Math.acos(THREE.MathUtils.clamp(new THREE.Vector3(0, 1, 0).applyQuaternion(q).y, -1, 1))

export function createLane() {
  const planes = [
    laneSurface({ halfWidth: LANE_W / 2, R: GUTTER_R, zFrom: PIT_Z, zTo: FOUL_Z + 0.5, pitDepth: PIT_DEPTH }),
    { n: new THREE.Vector3(1, 0, 0), d: -KICKBACK_X, e: 0.35, mu: 0.3 }, // kickbacks
    { n: new THREE.Vector3(-1, 0, 0), d: -KICKBACK_X, e: 0.35, mu: 0.3 },
    { n: new THREE.Vector3(0, 0, 1), d: -1.5, e: 0.08, mu: 0.6 }, // the pit curtain
  ]
  const lane = {
    planes,
    pins: Array.from({ length: 10 }, () => Object.assign(pinBody(), { removed: false })),
    ball: ballBody(),
    rolling: false, // a ball is on its way
    released: 0, // seconds since the ball was let go
    quiet: 0, // seconds since anything last moved
    hitPins: false,
  }
  rack(lane)
  parkBall(lane)
  return lane
}

function parkBall(lane) {
  const b = lane.ball
  b.active = false
  b.vel.set(0, 0, 0)
  b.ang.set(0, 0, 0)
  b.pos.set(0, -2, FOUL_Z + 2)
  b.update()
  lane.rolling = false
}

/**
 * Stands pins on their spots. `keep` lists which of the ten to stand (default all ten); the rest are taken off the
 * deck. Each pin is turned a little differently, like a real set.
 */
export function rack(lane, keep = null) {
  lane.pins.forEach((p, i) => {
    const on = keep ? keep[i] : true
    p.vel.set(0, 0, 0)
    p.ang.set(0, 0, 0)
    p.active = false
    p.still = 0
    p.removed = !on
    if (on) {
      p.pos.set(RACK[i][0], PIN_COM, RACK[i][1])
      p.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.39996) % (Math.PI * 2))
    } else p.pos.set(RACK[i][0], -5, RACK[i][1])
    p.update()
  })
}

/**
 * Lets a ball go from the foul line. x: where along the line (m from the middle, + is right), angle: its heading
 * (radians, + turns it to the right), speed: m/s, hook: side spin (rad/s, + curves it left, as a right-hander's does).
 */
export function bowl(lane, { x = 0, angle = 0, speed = 8, hook = 0 }) {
  const b = lane.ball
  const dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle))
  b.pos.set(THREE.MathUtils.clamp(x, -LANE_W / 2 + BALL_R, LANE_W / 2 - BALL_R), BALL_R, RELEASE_Z)
  b.vel.copy(dir).multiplyScalar(speed)
  // released skidding: turning forward at about half its rolling speed, plus side-roll about the line of travel
  b.ang.crossVectors(new THREE.Vector3(0, 1, 0), b.vel).multiplyScalar(0.55 / BALL_R).addScaledVector(dir, -hook)
  b.quat.identity()
  b.update()
  b.wake()
  lane.rolling = true
  lane.released = 0
  lane.quiet = 0
  lane.hitPins = false
}

/** One physics step of h seconds. `play(name, strength)` is called for sounds: knock, clack, thock. */
export function stepLane(lane, h, play) {
  const { pins, ball, planes } = lane
  for (const p of pins) {
    if (p.removed) continue
    p.step(h, planes, play ? (_, s) => play('knock', s / 3) : undefined)
    // a pin rocking upright on its base ring loses its wobble to the deck
    if (p.active && p.grounded && tiltOf(p.quat) < 0.05) {
      p.ang.x *= Math.exp(-7 * h)
      p.ang.z *= Math.exp(-7 * h)
    }
  }
  if (ball.active) {
    // slick on the oil, grippy on the dry back end
    ball.mu = ball.pos.z > OIL_END_Z ? MU_OIL : MU_DRY
    ball.step(h, planes)
    for (const p of pins) {
      if (p.removed) continue
      const s = collidePair(ball, p, 0.62, 0.15)
      if (s > 0) lane.hitPins = true
      if (s > 0.3 && play) play('thock', s / 7)
    }
    // gone once it has dropped into the pit
    if ((ball.pos.z < -1.3 && ball.pos.y < -0.1) || ball.pos.y < -0.5) {
      ball.active = false
      ball.pos.set(0, -2, FOUL_Z + 2)
      ball.update()
    }
  }
  for (let i = 0; i < 10; i++) {
    if (pins[i].removed) continue
    for (let j = i + 1; j < 10; j++) {
      if (pins[j].removed) continue
      const s = collidePair(pins[i], pins[j], 0.45, 0.2)
      if (s > 0.3 && play) play('clack', s / 4)
    }
  }
  if (lane.rolling) {
    lane.released += h
    // a pin rocking gently in the pit or a gutter does not hold up the count
    const moving = ball.active || pins.some((p) => !p.removed && p.active && (p.vel.lengthSq() > 0.0025 || p.ang.lengthSq() > 0.25))
    lane.quiet = moving ? 0 : lane.quiet + h
  }
}

/**
 * The ball has gone and the pins have all but stopped (or long enough has passed): time to count. A slow ball takes
 * about 4 s to reach the pins; anything still moving 12 s after release is counted where it lies.
 */
export function settled(lane) {
  if (!lane.rolling) return false
  if (lane.released > 12) return true
  return !lane.ball.active && lane.quiet > 0.8
}

/** Which pins are standing: upright, on its base, still on the deck. */
export function standing(lane) {
  return lane.pins.map((p) => !p.removed && tiltOf(p.quat) < 0.35 && p.pos.y > PIN_COM - 0.03 && p.pos.z > PIT_Z && Math.abs(p.pos.x) < LANE_W / 2)
}

/** Ends the ball: counts it and sweeps the deck (fallen pins away, the standing ones set back on their spots). */
export function sweep(lane, freshRack) {
  const up = standing(lane)
  rack(lane, freshRack ? null : up)
  parkBall(lane)
  return up
}

/** How many pins stood before this ball, so a count can be made from what is standing after it. */
export const pinsUp = (lane) => lane.pins.filter((p) => !p.removed).length
