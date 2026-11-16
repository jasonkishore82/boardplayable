import * as THREE from 'three'
import { BAT_L, HANDLE_Z, batSpheres } from './bat/shape.js'

// The batter in the nets: a bat held at the crease and moved by the player, and what happens when it meets a ball.
// Plain JS (no React), so the scene steps it inside the bowling machine's 600 Hz physics and the tests can fly real
// deliveries at it.
//
// World frame: the bowling machine's. It bowls along +x; the batter's stumps are at x = 12.5.
// The bat is driven, not simulated: input x and y in -1..1 (a phone's tilt, or the mouse). x slides the hands across
// the crease and turns the face (+1 is to the right as the batter sees it); y is the swing, +1 the top of the backlift, -1 the end of the follow-through. The
// bat follows the input through a stiff, critically damped spring, so a phone's 60 Hz stream becomes a smooth arc.
// With a phone the bat is free instead: input.q is the phone's turn since it was centred, as a quaternion in the bat's
// own frame (x across the face, y up the handle, z out of the back), and the bat turns about the top hand by exactly
// that, in every direction, from its stance. The mouse and the Space bar still use x and y.
// Each collision sphere remembers where it was a step ago, so it knows how fast it is moving: a ball that touches it
// comes off with the bat's speed added. Swing harder, hit further.

export const HANDS = { x: 11.12, y: 0.93 } // the top hand, a stride in front of the popping crease
export const GRIP_Y = BAT_L - 0.075 // where the top hand holds the handle, in the bat frame
const REACH = 0.32 // how far the hands slide across the crease at full tilt (m)
export const STANCE = THREE.MathUtils.degToRad(14) // the bat rests a little behind the feet
const BACKLIFT = THREE.MathUtils.degToRad(100)
const FOLLOW = THREE.MathUtils.degToRad(125)
const OPEN = THREE.MathUtils.degToRad(38) // how far the face turns at full tilt
const OMEGA = 46 // the spring's speed (rad/s): about 22 ms to follow a flick
const BAT_E = 0.5 // willow on leather, against a bat far heavier than the ball
const GRIP_FACE = 0.12 // how much of the ball's slide across the face the face takes out

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const FACE_TO_BOWLER = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI / 2) // the face (-z) looks down the pitch (-x)
const GRIP = new THREE.Vector3(0, GRIP_Y, HANDLE_Z)
// the stance as a turn: swung STANCE about the hands, face to the bowler (pose() with th = STANCE and no yaw)
const STANCE_Q = new THREE.Quaternion().setFromAxisAngle(Z, STANCE).multiply(FACE_TO_BOWLER)
const FREE_RATE = 40 // how fast a free bat catches up with the phone (1/s): about 25 ms behind
const STANCE_INV = STANCE_Q.clone().invert()
// A phone knows how it is turned but not where it is, so a free bat's hands ride on an arm: hung from the shoulder
// (above and behind the hands at the stance), it turns with part of the bat's turn. Lifting the bat takes the hands up
// and back, swinging through brings them forward and up, rolling it across carries them across the crease.
const SHOULDER = new THREE.Vector3(HANDS.x + 0.23, 1.5, 0)
const ARM_FOLLOW = 0.6 // how much of the bat's turn the arm takes
// With the webcam on (input.hands: how far the hands have moved since centring, in metres), the hands go where the
// webcam sees them instead of riding the arm. It runs at about 30 frames a second, so the grip eases after it.
const HAND_RATE = 18 // 1/s
const clamp = (v) => Math.max(-1, Math.min(1, v || 0))

/** The swing angle (radians about the hands, + towards the keeper) that input y asks for. */
export function swingTarget(y) {
  return y >= 0 ? STANCE + y * (BACKLIFT - STANCE) : STANCE + y * (FOLLOW + STANCE)
}

export function createBatter() {
  const local = batSpheres().map(([x, y, z, r]) => ({ p: new THREE.Vector3(x, y, z), r }))
  const b = {
    local,
    cur: local.map(() => new THREE.Vector3()),
    prev: local.map(() => new THREE.Vector3()),
    th: STANCE,
    thV: 0,
    z: 0,
    zV: 0,
    yaw: 0,
    yawV: 0,
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    hands: new THREE.Vector3(HANDS.x, HANDS.y, 0), // where the top hand holds the handle
    handOff: new THREE.Vector3(), // the webcam's move of the hands, eased
  }
  pose(b)
  for (let i = 0; i < local.length; i++) b.prev[i].copy(b.cur[i])
  return b
}

function pose(b) {
  const qy = new THREE.Quaternion().setFromAxisAngle(Y, b.yaw)
  const qz = new THREE.Quaternion().setFromAxisAngle(Z, b.th)
  // face to the bowler, then twisted about the handle (turning the face to leg or off without moving the blade), then
  // swung about the hands
  b.quat.copy(qz).multiply(qy).multiply(FACE_TO_BOWLER)
  b.hands.set(HANDS.x, HANDS.y, b.z).add(b.handOff)
  place(b)
}

const _handTarget = new THREE.Vector3()
// eases the webcam's hand offset towards input.hands (back to nothing when the webcam is off)
function followHands(b, input, h) {
  const t = input.hands
  _handTarget.set(t?.x || 0, t?.y || 0, t?.z || 0)
  b.handOff.lerp(_handTarget, 1 - Math.exp(-HAND_RATE * h))
}

// hangs the bat from the top hand (b.hands) at its current turn, and moves its collision spheres with it; if any part
// of it would go into the pitch, the whole bat is lifted clear
function place(b) {
  b.pos.copy(b.hands).sub(GRIP.clone().applyQuaternion(b.quat))
  let low = Infinity
  for (let i = 0; i < b.local.length; i++) {
    b.cur[i].copy(b.local[i].p).applyQuaternion(b.quat).add(b.pos)
    low = Math.min(low, b.cur[i].y - b.local[i].r)
  }
  if (low < 0.005) {
    const up = 0.005 - low
    b.hands.y += up
    b.pos.y += up
    for (const c of b.cur) c.y += up
  }
}

const _target = new THREE.Quaternion()
const _turn = new THREE.Quaternion()
const _arm = new THREE.Quaternion()
const _identity = new THREE.Quaternion()

/**
 * Moves the bat one physics step of h seconds towards the input: { q } (a phone's turn, [x, y, z, w]) turns it freely,
 * otherwise { x, y } swings it. { hands } ({ x, y, z } metres from the webcam) moves the grip, with either.
 */
export function stepBatter(b, input, h) {
  followHands(b, input, h)
  if (input.q) {
    for (let i = 0; i < b.local.length; i++) b.prev[i].copy(b.cur[i])
    _target.set(input.q[0], input.q[1], input.q[2], input.q[3]).normalize()
    _target.premultiply(STANCE_Q)
    b.quat.slerp(_target, 1 - Math.exp(-FREE_RATE * h))
    if (input.hands) {
      // the webcam sees the hands: they go where they are
      b.hands.set(HANDS.x, HANDS.y, 0).add(b.handOff)
    } else {
      // the hands ride the arm: the bat's turn since the stance, in world axes, a share of it taken about the shoulder
      _turn.copy(b.quat).multiply(STANCE_INV)
      _arm.slerpQuaternions(_identity, _turn, ARM_FOLLOW)
      b.hands.set(HANDS.x, HANDS.y, 0).sub(SHOULDER).applyQuaternion(_arm).add(SHOULDER).add(b.handOff)
    }
    // the two-axis springs rest at the stance, ready for when the phone lets go
    b.th = STANCE
    b.thV = b.z = b.zV = b.yaw = b.yawV = 0
    place(b)
    return
  }
  const spring = (x, v, target) => {
    const nv = v + (OMEGA * OMEGA * (target - x) - 2 * OMEGA * v) * h
    return [x + nv * h, nv]
  }
  ;[b.th, b.thV] = spring(b.th, b.thV, swingTarget(clamp(input.y)))
  // Seen from behind the batter (looking down the pitch, -x), screen right is -z: tilt right, the bat goes right and
  // its face turns that way.
  ;[b.z, b.zV] = spring(b.z, b.zV, -clamp(input.x) * REACH)
  ;[b.yaw, b.yawV] = spring(b.yaw, b.yawV, -clamp(input.x) * OPEN)
  for (let i = 0; i < b.local.length; i++) b.prev[i].copy(b.cur[i])
  pose(b)
}

const _n = new THREE.Vector3()
const _vb = new THREE.Vector3()
const _rel = new THREE.Vector3()

/**
 * Bat against ball for one step. `ball` is a body from tennisball/physics.js ({ p, v, r }). Pushes the ball out of
 * the bat and, if they were closing, bounces it off with the bat's own speed. Returns the closing speed (m/s) of the
 * hardest contact, or 0 if they did not meet.
 */
export function collideBat(b, ball, h) {
  if (Math.abs(ball.p.x - HANDS.x) > 1.9) return 0 // only near the crease (in the bat's and the arm's reach) is there anything to hit
  let hardest = 0
  for (let i = 0; i < b.local.length; i++) {
    const s = b.cur[i]
    const r = b.local[i].r
    const n = _n.subVectors(ball.p, s)
    const dist = n.length()
    if (dist >= r + ball.r || dist < 1e-7) continue
    n.divideScalar(dist)
    const vb = _vb.subVectors(b.cur[i], b.prev[i]).divideScalar(h)
    const rel = _rel.subVectors(ball.v, vb)
    const vn = rel.dot(n)
    ball.p.copy(s).addScaledVector(n, r + ball.r + 0.0005)
    if (vn >= 0) continue
    ball.v.addScaledVector(n, -(1 + BAT_E) * vn)
    rel.addScaledVector(n, -vn)
    ball.v.addScaledVector(rel, -GRIP_FACE)
    hardest = Math.max(hardest, -vn)
  }
  return hardest
}
