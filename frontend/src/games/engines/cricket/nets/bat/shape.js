import * as THREE from 'three'

// The bat's shape, shared by the rendered bat (Bat.jsx) and the nets' physics (../batter.js): its dimensions, the
// blade's cross-section at any height, and the spheres it collides with.
// SI units: metres. Bat frame: toe at the origin, up the handle along +y, the face looking along -z.

// a short-handle senior bat (Laws of Cricket: at most 965 mm long, 108 mm
// wide, 67 mm deep, edges at most 40 mm)
export const BLADE_L = 0.56
export const BLADE_HW = 0.054
export const FACE_Z = -0.022
export const BAT_L = 0.955
export const HANDLE_R = 0.0158
export const GRIP_R = 0.0186
export const MASS = 1.18
// the balance point, about a third of the way up from the toe on a modern bat
export const COM = new THREE.Vector3(0, 0.33, -0.004)

export const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// The blade's cross-section at height y up from the toe: its half width, the
// depth of its edges, the depth at the spine, and where the face is.
export function section(y) {
  const sh = sm(BLADE_L - 0.065, BLADE_L, y) // the shoulders slope into the handle
  const rc = 0.014 // toe corners are rounded off
  const toeIn = y < rc ? rc - Math.sqrt(rc * rc - (rc - y) ** 2) : 0
  const mid = Math.exp(-(((y - 0.19) / 0.21) ** 2)) // the middle: where the wood is
  const hw = BLADE_HW * (1 - 0.69 * sh) - toeIn * 0.9
  const ts = (0.044 + 0.022 * mid) * (1 - 0.52 * sh) - toeIn * 0.7
  const te = (0.035 + 0.003 * mid) * (1 - 0.6 * sh) - toeIn * 0.7
  const z0 = FACE_Z + 0.0035 * Math.sin((Math.PI * Math.min(y, BLADE_L)) / BLADE_L) * (1 - sh)
  return { hw, ts, te, z0, sh }
}
// where the handle sits: centred on the blade's depth at the shoulder
export const HANDLE_Z = (() => {
  const s = section(BLADE_L)
  return s.z0 + s.ts * 0.5
})()

// The bat's collision shape: spheres down the face, the edges and the spine,
// and along the handle, in the bat frame relative to `origin` (the centre of
// mass for the free body; the toe, the bat frame's origin, by default).
export function batSpheres(origin = new THREE.Vector3()) {
  const out = []
  for (let i = 0; i <= 14; i++) {
    const y = 0.008 + (i / 14) * (BLADE_L - 0.03)
    const { hw, ts, te, z0 } = section(y)
    const r = Math.min(0.009, hw * 0.3)
    for (const x of [-(hw - r), 0, hw - r]) out.push([x, y, z0 + r, r]) // the face
    for (const x of [-(hw - r), hw - r]) out.push([x, y, z0 + te - r, r]) // the edges
    out.push([0, y, z0 + ts - 0.012, 0.012]) // the spine
  }
  for (let y = BLADE_L + 0.03; y <= BAT_L - 0.01; y += 0.05) out.push([0, y, HANDLE_Z, GRIP_R])
  return out.map(([x, y, z, r]) => [x - origin.x, y - origin.y, z - origin.z, r])
}
