import * as THREE from 'three'

// Generated maps for the wooden chessboard (no image files) and the builder for its mitred frame rails.

function makeNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  const wrap = (a: number, P: number) => (P ? ((a % P) + P) % P : a)
  const noise = (x: number, y: number, Px = 0, Py = Px) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = hash(wrap(xi, Px), wrap(yi, Py))
    const b = hash(wrap(xi + 1, Px), wrap(yi, Py))
    const c = hash(wrap(xi, Px), wrap(yi + 1, Py))
    const d = hash(wrap(xi + 1, Px), wrap(yi + 1, Py))
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x: number, y: number, oct = 4, Px = 0, Py = Px) => {
    let t = 0
    let amp = 0.5
    let f = 1
    let norm = 0
    for (let i = 0; i < oct; i++) {
      t += noise(x * f, y * f, Px ? Px * f : 0, Py ? Py * f : 0) * amp
      norm += amp
      f *= 2
      amp *= 0.5
    }
    return t / norm
  }
  return { hash, noise, fbm }
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

/** The lacquer's faint orange peel, as a normal map for the clearcoat to break up on. */
export function buildPeel(seed = 9) {
  const S = 512
  const N = makeNoise(seed)
  const h = new Float32Array(S * S)
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) h[j * S + i] = N.fbm(i / 16, j / 16, 3, 32)
  const out = new Uint8Array(S * S * 4)
  const K = 1.4
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)]
      const dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i]
      const l = Math.hypot(dx * K, dy * K, 1)
      out[k * 4] = ((-dx * K) / l * 0.5 + 0.5) * 255
      out[k * 4 + 1] = ((-dy * K) / l * 0.5 + 0.5) * 255
      out[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255
      out[k * 4 + 3] = 255
    }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/**
 * Figured hardwood (tinted by the material colour): grain running along u, with the soft ripple figure of polished
 * mahogany. Tiles along u every GRAIN.along metres; v spans GRAIN.across metres.
 */
export const GRAIN = { along: 0.6, across: 0.06 }
export function buildWood(seed = 12) {
  const W = 2048
  const H = 256
  const N = makeNoise(seed)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = i / W
      const v = j / H
      const warp = N.fbm(u * 4, v * 1.5, 3, 4, 2) * 1.6
      const ring = v * 3.2 + warp * 1.2
      const f = ring - Math.floor(ring)
      const late = Math.pow(f, 3)
      const pores = N.noise(u * 700, v * 60, 700, 60)
      const streak = N.noise(u * 5, v * 140, 5, 140)
      const ripple = Math.sin((u * 36 + v * 4 + N.fbm(u * 3, v * 2, 3, 3, 2) * 6) * Math.PI) * 0.5 + 0.5
      const t = clamp(
        0.8 -
          late * 0.14 +
          (pores > 0.82 ? -0.06 : 0) +
          (streak - 0.5) * 0.12 +
          (ripple - 0.5) * 0.035 +
          (N.fbm(u * 8, v * 3, 3, 8, 3) - 0.5) * 0.18,
      )
      const k = (j * W + i) * 4
      img.data[k] = t * 255
      img.data[k + 1] = t * 238
      img.data[k + 2] = t * 222
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 16
  return t
}

/**
 * One rail of a picture-style frame, swept from a moulding profile and cut at 45 degrees, lying along x at the front
 * (+z) of a square frame of half size `outer`; turn it by 90 degree steps for the other three. The profile runs from
 * the outer bottom edge inwards as [inset from the outer edge, height] (list a point twice to keep a crisp edge).
 * UVs: u along the rail (offset by uOffset metres so each rail shows different grain), v round the profile.
 */
export function mitredRail(profile: [number, number][], outer: number, uOffset = 0, grain = GRAIN) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let arc = 0
  profile.forEach(([d, y], i) => {
    if (i > 0) arc += Math.hypot(d - profile[i - 1][0], y - profile[i - 1][1])
    const half = outer - d
    pos.push(-half, y, outer - d, half, y, outer - d)
    uv.push((uOffset - half) / grain.along, arc / grain.across, (uOffset + half) / grain.along, arc / grain.across)
  })
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  // the underside, from the outer edge to the profile's innermost point
  const w = Math.max(...profile.map(([d]) => d))
  const b = pos.length / 3
  pos.push(-outer, 0, outer, outer, 0, outer, -(outer - w), 0, outer - w, outer - w, 0, outer - w)
  uv.push(0, 0, 1, 0, 0, 0.5, 1, 0.5)
  idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(idx)
  geometry.computeVertexNormals()
  return geometry
}
