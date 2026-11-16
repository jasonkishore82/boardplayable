import * as THREE from 'three'

// Generated wood and lacquer maps shared by the board models. No image files.
// (Only the parts the roulette table uses: the figured hardwood and the lacquer's orange peel.)

function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  const wrap = (a, P) => (P ? ((a % P) + P) % P : a)
  const noise = (x, y, Px = 0, Py = Px) => {
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
  const fbm = (x, y, oct = 4, Px = 0, Py = Px) => {
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
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

// The laminate's faint orange peel, for the gloss to break up on.
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
      out[k * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255
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

// Figured hardwood (tinted by the wood colour): grain running along u, with the soft ripple figure of polished
// mahogany. Tiles along u every 0.6 m; v spans 0.06 m (round the rail's profile).
export const GRAIN = { along: 0.6, across: 0.06 }
export function buildWood(seed = 12) {
  const W = 2048
  const H = 256
  const N = makeNoise(seed)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
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
      const t = clamp(0.8 - late * 0.14 + (pores > 0.82 ? -0.06 : 0) + (streak - 0.5) * 0.12 + (ripple - 0.5) * 0.035 + (N.fbm(u * 8, v * 3, 3, 8, 3) - 0.5) * 0.18)
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
