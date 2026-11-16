import * as THREE from 'three'

// Rigid-body physics for a cricket bat and ball, with no physics library.
// SI units: metres, kilograms, seconds, real gravity. +y is up.
//
// Each body's shape is a set of spheres in its own frame. The bat is spheres
// along its face, its edges, its spine and its handle; the ball is one sphere.
// Any sphere that dips into the ground gets a normal impulse (a dull bounce
// for willow) and a Coulomb friction impulse at the contact point, so a bat
// knocked over lands on an edge, rocks across its curved spine and settles
// face down or face up the way a real one does. Bat and ball meet sphere to
// sphere, with an impulse on each.

export const G = 9.81
export const BALL = { r: 0.0361, m: 0.16 }

const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _r = new THREE.Vector3()
const _n = new THREE.Vector3()
const _t = new THREE.Vector3()
const _k = new THREE.Vector3()
const _m3 = new THREE.Matrix3()
const _m4 = new THREE.Matrix4()

// A free rigid body. `I` is the diagonal inertia in the body frame; `spheres`
// are [x, y, z, r] in the body frame (relative to the centre of mass).
export class Body {
  constructor({ m, I, spheres, e = 0.3, mu = 0.5, roll = 0 }) {
    this.m = m
    this.invI = new THREE.Vector3(1 / I[0], 1 / I[1], 1 / I[2])
    this.spheres = spheres.map(([x, y, z, r]) => ({ p: new THREE.Vector3(x, y, z), r }))
    this.e = e
    this.mu = mu
    this.roll = roll // rolling resistance, as an angular damping rate on the ground
    this.pos = new THREE.Vector3()
    this.quat = new THREE.Quaternion()
    this.vel = new THREE.Vector3()
    this.ang = new THREE.Vector3()
    this.active = false
    this.still = 0
    this.grounded = false
  }

  // world inverse inertia: R diag(1/I) R^T
  invInertia(out) {
    _m4.makeRotationFromQuaternion(this.quat)
    const R = _m3.setFromMatrix4(_m4)
    const e = R.elements
    const d = this.invI
    // M = R D R^T, written out (column-major elements)
    const o = out.elements
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        o[j * 3 + i] = e[i] * d.x * e[j] + e[3 + i] * d.y * e[3 + j] + e[6 + i] * d.z * e[6 + j]
      }
    return out
  }

  // velocity of a world point fixed to the body
  pointVel(p, out) {
    _r.subVectors(p, this.pos)
    return out.crossVectors(this.ang, _r).add(this.vel)
  }

  applyImpulse(J, p, invIw) {
    this.vel.addScaledVector(J, 1 / this.m)
    _r.subVectors(p, this.pos)
    _w.crossVectors(_r, J).applyMatrix3(invIw)
    this.ang.add(_w)
  }

  // the effective inverse mass of the body at point p along direction n
  kAt(p, n, invIw) {
    _r.subVectors(p, this.pos)
    _w.crossVectors(_r, n).applyMatrix3(invIw)
    _k.crossVectors(_w, _r)
    return 1 / this.m + n.dot(_k)
  }

  step(dt, onHit) {
    if (!this.active) return
    this.vel.y -= G * dt
    this.pos.addScaledVector(this.vel, dt)
    const a = this.ang.length()
    if (a > 1e-9) {
      const dq = new THREE.Quaternion().setFromAxisAngle(_v.copy(this.ang).divideScalar(a), a * dt)
      this.quat.premultiply(dq).normalize()
    }
    // the turf
    const invIw = this.invInertia(new THREE.Matrix3())
    let pen = 0
    this.grounded = false
    const wp = new THREE.Vector3()
    const cp = new THREE.Vector3()
    const vp = new THREE.Vector3()
    for (const s of this.spheres) {
      wp.copy(s.p).applyQuaternion(this.quat).add(this.pos)
      const d = s.r - wp.y
      if (d <= 0) continue
      this.grounded = true
      pen = Math.max(pen, d)
      cp.set(wp.x, 0, wp.z)
      this.pointVel(cp, vp)
      const vn = vp.y
      if (vn >= 0) continue
      _n.set(0, 1, 0)
      const e = -vn > 0.4 ? this.e : 0 // no bouncing on a resting contact
      const jn = (-(1 + e) * vn) / this.kAt(cp, _n, invIw)
      this.applyImpulse(_n.multiplyScalar(jn), cp, invIw)
      if (onHit && -vn > 0.6) onHit(this, -vn)
      // friction against the slide at the contact
      this.pointVel(cp, vp)
      vp.y = 0
      const vt = vp.length()
      if (vt > 1e-6) {
        _t.copy(vp).divideScalar(-vt)
        const jt = Math.min(vt / this.kAt(cp, _t, invIw), this.mu * jn)
        this.applyImpulse(_t.multiplyScalar(jt), cp, invIw)
      }
    }
    if (pen > 0) this.pos.y += pen
    if (this.grounded && this.roll) {
      // grass drags at anything rolling or sliding on it
      const k = Math.exp(-this.roll * dt)
      this.ang.multiplyScalar(k)
      const kl = Math.exp(-this.roll * 0.6 * dt)
      this.vel.x *= kl
      this.vel.z *= kl
    }
    this.ang.multiplyScalar(Math.exp(-0.05 * dt)) // air
    // rest
    if (this.grounded && this.vel.lengthSq() < 0.0004 && this.ang.lengthSq() < 0.04) {
      this.still += dt
      if (this.still > 0.4) {
        this.active = false
        this.vel.set(0, 0, 0)
        this.ang.set(0, 0, 0)
      }
    } else this.still = 0
  }
}


// closest point on segment ab to p
export function closestOnSegment(a, b, p, out) {
  _v.subVectors(b, a)
  const t = THREE.MathUtils.clamp(_t.subVectors(p, a).dot(_v) / _v.lengthSq(), 0, 1)
  return out.copy(a).addScaledVector(_v, t)
}

export function ballBody() {
  const I = 0.4 * BALL.m * BALL.r * BALL.r
  return new Body({ m: BALL.m, I: [I, I, I], spheres: [[0, 0, 0, BALL.r]], e: 0.55, mu: 0.3, roll: 1.2 })
}

// A two-body impulse at contact point p with normal n pointing from B to A.
// Each side is a Body, or B is null for something immovable, in which case
// `vB` is its surface velocity there. Returns the closing speed.
export function collide(A, B, p, n, e, mu, vB = null) {
  const va = A.pointVel(p, new THREE.Vector3())
  const vb = B ? B.pointVel(p, new THREE.Vector3()) : vB || new THREE.Vector3()
  const rel = va.sub(vb)
  const vn = rel.dot(n)
  if (vn >= 0) return 0
  const invA = A.invInertia ? A.invInertia(new THREE.Matrix3()) : null
  const invB = B?.invInertia ? B.invInertia(new THREE.Matrix3()) : null
  const k = (A.invInertia ? A.kAt(p, n, invA) : A.kAt(p, n)) + (B ? (B.invInertia ? B.kAt(p, n, invB) : B.kAt(p, n)) : 0)
  const j = (-(1 + e) * vn) / k
  const J = n.clone().multiplyScalar(j)
  A.invInertia ? A.applyImpulse(J, p, invA) : A.applyImpulse(J, p)
  if (B) B.invInertia ? B.applyImpulse(J.clone().negate(), p, invB) : B.applyImpulse(J.clone().negate(), p)
  // a little friction along the surface (puts spin on the ball)
  const tang = rel.addScaledVector(n, -vn)
  const vt = tang.length()
  if (vt > 1e-5 && mu > 0) {
    const t = tang.divideScalar(-vt)
    const kt = (A.invInertia ? A.kAt(p, t, invA) : A.kAt(p, t)) + (B ? (B.invInertia ? B.kAt(p, t, invB) : B.kAt(p, t)) : 0)
    const jt = Math.min(vt / kt, mu * j)
    const Jt = t.multiplyScalar(jt)
    A.invInertia ? A.applyImpulse(Jt, p, invA) : A.applyImpulse(Jt, p)
    if (B) B.invInertia ? B.applyImpulse(Jt.clone().negate(), p, invB) : B.applyImpulse(Jt.clone().negate(), p)
  }
  return -vn
}
