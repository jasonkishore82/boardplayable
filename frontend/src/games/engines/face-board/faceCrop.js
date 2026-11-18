// Finds the face in a photo (MediaPipe's Face Detector) and crops the photo to it, head and shoulders, in the card's
// window shape. A full-length photo becomes a face card instead of a tiny figure.
//
// The detector is MediaPipe's short-range BlazeFace, made for faces that fill a good part of the picture. A face in a
// full-length photo is too small for it at one look, so when the whole photo finds nothing it looks again at
// overlapping tiles of it, each smaller than the last, until the face fills enough of one to be found.

const VERSION = '1.2.3' // keep in step with @mediapipe/tasks-vision in package.json
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

const CARD_ASPECT = 0.72 // the card's photo window, width over height
const HEAD = 2.4 // the crop's width, in face widths: room for the hair, ears and shoulders
const EYE_LINE = 0.42 // where the face's centre sits, down from the crop's top
const MAX_PX = 360 // the stored photo's longer side, so a board full of them stays small enough to keep

let detectorPromise = null
function detector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM)
      const make = (delegate) =>
        FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 })
      return make('GPU').catch(() => make('CPU'))
    })()
    // a failed load (offline, blocked) is tried again next time
    detectorPromise.catch(() => (detectorPromise = null))
  }
  return detectorPromise
}

// the most confident face in one region of the image, in the image's pixels, or null
function look(det, img, x, y, w, h) {
  const k = Math.min(1, 640 / Math.max(w, h))
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) })
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height)
  let best = null
  for (const d of det.detect(c).detections ?? []) {
    const b = d.boundingBox
    const score = d.categories?.[0]?.score ?? 0
    if (b && (!best || score > best.score)) best = { x: x + b.originX / k, y: y + b.originY / k, w: b.width / k, h: b.height / k, score }
  }
  return best
}

/** The face in an image element: { x, y, w, h } in its pixels, or null when there isn't one to be found. */
export async function findFace(img) {
  const det = await detector()
  const W = img.naturalWidth
  const H = img.naturalHeight
  const whole = look(det, img, 0, 0, W, H)
  if (whole) return whole
  // tiles: n across the longer side, overlapping by half, smaller each pass
  for (const n of [2, 3, 4, 5]) {
    const t = Math.min(Math.min(W, H), (Math.max(W, H) / n) * 1.4)
    const steps = (len) => {
      const out = []
      for (let p = 0; p + t < len; p += t / 2) out.push(p)
      out.push(Math.max(0, len - t))
      return out
    }
    let best = null
    for (const ty of steps(H))
      for (const tx of steps(W)) {
        const f = look(det, img, tx, ty, t, t)
        if (f && (!best || f.score > best.score)) best = f
      }
    if (best) return best
  }
  return null
}

const loadImage = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })

/**
 * A photo file made into a card picture: cropped to the face when one is found, else the whole photo, scaled down
 * either way. Resolves { src (a JPEG data URL), found }, or null when the file isn't an image that loads.
 */
export async function faceCard(file) {
  const loaded = await loadImage(file)
  if (!loaded) return null
  const { img, url } = loaded
  const W = img.naturalWidth
  const H = img.naturalHeight
  let face = null
  try {
    face = await findFace(img)
  } catch {
    face = null // no detector (offline): the whole photo, as before
  }
  let sx = 0
  let sy = 0
  let sw = W
  let sh = H
  if (face) {
    sw = face.w * HEAD
    sh = sw / CARD_ASPECT
    if (sh > H) {
      sh = H
      sw = sh * CARD_ASPECT
    }
    if (sw > W) {
      sw = W
      sh = sw / CARD_ASPECT
    }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    sx = clamp(face.x + face.w / 2 - sw / 2, 0, W - sw)
    sy = clamp(face.y + face.h / 2 - sh * EYE_LINE, 0, H - sh)
  }
  const s = Math.min(1, MAX_PX / Math.max(sw, sh))
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(sw * s), height: Math.round(sh * s) })
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return { src: c.toDataURL('image/jpeg', 0.86), found: !!face }
}
