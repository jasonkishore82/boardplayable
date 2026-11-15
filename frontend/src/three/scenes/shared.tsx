import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type SceneMode = '3d' | 'cinematic'

/** What every 3D board receives. `game` is the same state the flat board uses. */
export type SceneProps = {
  game: unknown
  myId: string | undefined
  send: (message: Record<string, unknown>) => void
  mode: SceneMode
}

// Colours shared by the boards, in line with the app's theme.
export const COLORS = {
  accent: '#3ddc97',
  pink: '#f2f2f2',
  gold: '#f5c542',
  danger: '#ff5c6c',
  light: '#ececea',
  dark: '#4a4a4a',
  frame: '#111111',
  ivory: '#f6f6f4',
  ebony: '#161616',
}

type RigProps = {
  mode: SceneMode
  /** Look from the other side (when you are playing black). */
  flipped?: boolean
  /** Where the camera should look in cinematic mode, such as the last move. */
  focus?: [number, number, number]
  /** How far the camera sits from the middle of the board. */
  distance: number
}

/**
 * The camera. In 3D view you drag to turn the board and scroll to zoom.
 * In cinematic view it glides on its own: a slow sweep around the board, drifting in and out and up and down,
 * with its gaze drawn to the latest move.
 */
export function CameraRig({ mode, flipped = false, focus = [0, 0, 0], distance }: RigProps) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const dom = useThree((state) => state.gl.domElement)
  const controls = useRef<OrbitControls | null>(null)
  const clock = useRef(0)
  const look = useRef(new Vector3(0, 0.3, 0))
  const side = flipped ? -1 : 1

  useEffect(() => {
    camera.fov = mode === 'cinematic' ? 30 : 38
    camera.updateProjectionMatrix()

    if (mode === '3d') {
      camera.position.set(0, distance * 0.78, side * distance * 0.9)
      const orbit = new OrbitControls(camera, dom)
      orbit.enableDamping = true
      orbit.dampingFactor = 0.08
      orbit.enablePan = false
      orbit.maxPolarAngle = Math.PI * 0.48
      orbit.minDistance = distance * 0.45
      orbit.maxDistance = distance * 1.8
      orbit.target.set(0, 0, 0)
      orbit.update()
      controls.current = orbit
      return () => {
        orbit.dispose()
        controls.current = null
      }
    }

    clock.current = 0
    look.current.set(0, 0.3, 0)
    return undefined
  }, [mode, camera, dom, distance, side])

  useFrame((_, delta) => {
    if (mode === '3d') {
      controls.current?.update()
      return
    }
    clock.current += Math.min(delta, 0.1)
    const t = clock.current
    const start = side > 0 ? 0 : Math.PI
    const angle = start + Math.sin(t * 0.13) * 0.95 + t * 0.045
    const radius = distance * (0.64 + 0.14 * Math.sin(t * 0.21))
    const height = 2.4 + 1.7 * (0.5 + 0.5 * Math.sin(t * 0.17 + 1))
    camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius)

    // Ease the gaze toward the action instead of snapping to it.
    const target = new Vector3(focus[0] * 0.6, 0.35, focus[2] * 0.6)
    look.current.lerp(target, 1 - Math.exp(-delta * 1.6))
    camera.lookAt(look.current)
  })

  return null
}

/** Soft key light, two coloured accent lights, and in cinematic mode a coloured light that circles the board. */
export function SceneLights({ mode }: { mode: SceneMode }) {
  const swing = useRef<Group>(null)
  useFrame((_, delta) => {
    if (swing.current && mode === 'cinematic') swing.current.rotation.y += delta * 0.35
  })
  const cinematic = mode === 'cinematic'

  return (
    <>
      <ambientLight intensity={cinematic ? 0.35 : 0.6} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={cinematic ? 1.5 : 1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-6, 3.5, -4]} intensity={cinematic ? 42 : 26} color={COLORS.accent} />
      <pointLight position={[6, 3.5, -5]} intensity={cinematic ? 42 : 26} color={COLORS.pink} />
      {cinematic && (
        <group ref={swing}>
          <pointLight position={[7, 2.2, 0]} intensity={36} color="#ffffff" />
        </group>
      )}
    </>
  )
}

/** The white round stage the board stands on. */
export function Floor({ radius = 14, y = -0.26 }: { radius?: number; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} receiveShadow>
      <circleGeometry args={[radius, 72]} />
      <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0} />
    </mesh>
  )
}
