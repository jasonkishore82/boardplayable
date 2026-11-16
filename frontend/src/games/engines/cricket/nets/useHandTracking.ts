import { useEffect, useRef, useState } from 'react'

// Tracks the hands holding the bat (or the phone) with the computer's webcam, using MediaPipe's Hand Landmarker, so
// the bat's grip can move with them: the phone (or the mouse) still gives the bat's angle, the webcam gives where the
// hands are. From the gyrotest prototype.
//
// The webcam needs a secure page: http://localhost is fine, a LAN address over plain http is not.

const VERSION = '1.2.3' // keep in step with @mediapipe/tasks-vision in package.json
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

// the palm's centre: the wrist and the knuckles of the index, middle and little fingers
export const PALM = [0, 5, 9, 17]

/** x, y in 0..1 of the image (y down), size the palm's width there; averaged over both hands when two are seen. */
export type HandSample = { x: number; y: number; size: number }
type Landmark = { x: number; y: number }

/**
 * While `enabled`, runs the webcam and calls onHand for every frame: the hands' sample, or null when none are in view.
 * Returns the <video> ref for a preview, the landmarks to draw over it, and a status line.
 */
export function useHandTracking(enabled: boolean, onHand: (h: HandSample | null) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('off')
  const [hands, setHands] = useState<Landmark[][]>([])
  const cb = useRef(onHand)
  cb.current = onHand

  useEffect(() => {
    if (!enabled) {
      setStatus('off')
      setHands([])
      return undefined
    }
    let stop = false
    let stream: MediaStream | undefined
    let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks?: Landmark[][] }; close: () => void } | undefined
    let raf = 0
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('this page cannot use the webcam (open it on http://localhost)')
        setStatus('Starting webcam…')
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
        const video = videoRef.current
        if (stop || !video) return
        video.srcObject = stream
        await video.play()

        setStatus('Loading hand tracker…')
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM)
        const make = (delegate: 'GPU' | 'CPU') =>
          HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2 })
        landmarker = await make('GPU').catch(() => make('CPU'))
        if (stop) {
          landmarker.close()
          return
        }
        setStatus('Show your hands to the webcam')

        let lastTime = -1
        let found: boolean | null = null
        const loop = () => {
          if (stop || !landmarker) return
          raf = requestAnimationFrame(loop)
          if (video.currentTime === lastTime || video.readyState < 2) return
          lastTime = video.currentTime
          const lms = landmarker.detectForVideo(video, performance.now()).landmarks ?? []
          setHands(lms)
          if (!lms.length) {
            if (found !== false) setStatus('No hands in view')
            found = false
            cb.current(null)
            return
          }
          if (found !== true) setStatus(lms.length > 1 ? 'Tracking both hands' : 'Tracking your hand')
          found = true
          let x = 0
          let y = 0
          let size = 0
          for (const lm of lms) {
            for (const i of PALM) {
              x += lm[i].x
              y += lm[i].y
            }
            size += Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) + Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y)
          }
          const n = lms.length
          cb.current({ x: x / (n * PALM.length), y: y / (n * PALM.length), size: size / n })
        }
        loop()
      } catch (e) {
        setStatus(`Webcam off: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()
    return () => {
      stop = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      landmarker?.close()
      cb.current(null)
    }
  }, [enabled])

  return { videoRef, status, hands }
}

/**
 * The hands' move since `home`, in the nets' world (metres): the webcam faces you, and you face the bowler (-x), so
 * your right (the image's left) is -z, up is up, and a hand that looks bigger has come towards the screen, down the
 * pitch (-x). Clamped to a batter's reach.
 */
export function handOffset(home: HandSample, h: HandSample) {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  return {
    x: clamp(-(h.size / home.size - 1) * 0.5, -0.4, 0.4),
    y: clamp((home.y - h.y) * 0.9, -0.43, 0.62),
    z: clamp(-(home.x - h.x) * 1.1, -0.7, 0.7),
  }
}
