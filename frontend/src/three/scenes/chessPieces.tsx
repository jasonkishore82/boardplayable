import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import { LatheGeometry, MeshStandardMaterial, Vector2, type Group } from 'three'
import { COLORS } from './shared'

// Pieces are turned on a lathe: a profile of (radius, height) points is spun around the vertical axis.
type Profile = [number, number][]

const lathe = (profile: Profile) =>
  new LatheGeometry(
    profile.map(([radius, height]) => new Vector2(radius, height)),
    32,
  )

const PROFILES: Record<string, Profile> = {
  p: [[0, 0], [0.32, 0], [0.32, 0.07], [0.22, 0.14], [0.14, 0.42], [0.2, 0.46], [0.2, 0.5], [0.1, 0.54], [0, 0.54]],
  r: [[0, 0], [0.36, 0], [0.36, 0.08], [0.26, 0.17], [0.21, 0.62], [0.3, 0.67], [0.3, 0.82], [0.2, 0.82], [0.2, 0.76], [0, 0.76]],
  n: [[0, 0], [0.34, 0], [0.34, 0.08], [0.24, 0.17], [0.2, 0.3], [0, 0.3]],
  b: [[0, 0], [0.34, 0], [0.34, 0.08], [0.22, 0.17], [0.12, 0.5], [0.2, 0.55], [0.2, 0.59], [0.12, 0.64], [0.2, 0.8], [0.12, 0.98], [0, 1.04]],
  q: [[0, 0], [0.38, 0], [0.38, 0.08], [0.24, 0.18], [0.14, 0.7], [0.26, 0.78], [0.26, 0.87], [0.18, 0.95], [0.3, 1.12], [0.1, 1.14], [0, 1.14]],
  k: [[0, 0], [0.38, 0], [0.38, 0.08], [0.24, 0.18], [0.15, 0.74], [0.27, 0.82], [0.27, 0.9], [0.19, 0.98], [0.28, 1.12], [0.12, 1.16], [0, 1.16]],
}

// Built once and shared by every piece of that kind.
const geometries: Record<string, LatheGeometry> = Object.fromEntries(
  Object.entries(PROFILES).map(([type, profile]) => [type, lathe(profile)]),
)

/** One pair of materials for the whole board. */
export function usePieceMaterials(cinematic: boolean) {
  return useMemo(
    () => ({
      white: new MeshStandardMaterial({ color: COLORS.ivory, roughness: 0.32, metalness: 0.12 }),
      black: new MeshStandardMaterial({
        color: COLORS.ebony,
        roughness: 0.28,
        metalness: 0.45,
        emissive: '#27344f',
        emissiveIntensity: cinematic ? 0.4 : 0.25,
      }),
    }),
    [cinematic],
  )
}

type ModelProps = { type: string; material: MeshStandardMaterial; towards: 1 | -1 }

/** The shape of one piece, standing on the origin. `towards` is which way a knight looks (-1 is toward black). */
function PieceModel({ type, material, towards }: ModelProps): ReactNode {
  const base = <mesh geometry={geometries[type]} material={material} castShadow />
  switch (type) {
    case 'p':
      return (
        <>
          {base}
          <mesh position={[0, 0.66, 0]} material={material} castShadow>
            <sphereGeometry args={[0.17, 24, 16]} />
          </mesh>
        </>
      )
    case 'r':
      return (
        <>
          {base}
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              position={[Math.cos((i * Math.PI) / 2) * 0.23, 0.88, Math.sin((i * Math.PI) / 2) * 0.23]}
              material={material}
              castShadow
            >
              <boxGeometry args={[0.13, 0.14, 0.13]} />
            </mesh>
          ))}
        </>
      )
    case 'b':
      return (
        <>
          {base}
          <mesh position={[0, 1.1, 0]} material={material} castShadow>
            <sphereGeometry args={[0.07, 16, 12]} />
          </mesh>
        </>
      )
    case 'q':
      return (
        <>
          {base}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh
              key={i}
              position={[Math.cos((i * Math.PI) / 3) * 0.2, 1.18, Math.sin((i * Math.PI) / 3) * 0.2]}
              material={material}
              castShadow
            >
              <sphereGeometry args={[0.06, 12, 10]} />
            </mesh>
          ))}
          <mesh position={[0, 1.28, 0]} material={material} castShadow>
            <sphereGeometry args={[0.1, 16, 12]} />
          </mesh>
        </>
      )
    case 'k':
      return (
        <>
          {base}
          <mesh position={[0, 1.34, 0]} material={material} castShadow>
            <boxGeometry args={[0.09, 0.32, 0.09]} />
          </mesh>
          <mesh position={[0, 1.38, 0]} material={material} castShadow>
            <boxGeometry args={[0.24, 0.08, 0.09]} />
          </mesh>
        </>
      )
    case 'n':
      return (
        <group rotation-y={towards === 1 ? 0 : Math.PI}>
          {base}
          <mesh position={[0, 0.58, 0.04]} rotation-x={0.3} material={material} castShadow>
            <boxGeometry args={[0.27, 0.62, 0.3]} />
          </mesh>
          <mesh position={[0, 0.92, -0.17]} rotation-x={-0.45} material={material} castShadow>
            <boxGeometry args={[0.23, 0.24, 0.5]} />
          </mesh>
          <mesh position={[0.08, 1.07, 0.07]} material={material} castShadow>
            <coneGeometry args={[0.055, 0.15, 8]} />
          </mesh>
          <mesh position={[-0.08, 1.07, 0.07]} material={material} castShadow>
            <coneGeometry args={[0.055, 0.15, 8]} />
          </mesh>
        </group>
      )
    default:
      return null
  }
}

type PieceProps = {
  /** Piece letter as the server sends it: capital is white. */
  letter: string
  position: [number, number, number]
  materials: { white: MeshStandardMaterial; black: MeshStandardMaterial }
  /** Where this piece came from, so it can glide in. */
  slideFrom?: [number, number] | null
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
}

const SLIDE_SECONDS = 0.5

/** A chess piece standing on a square. When it has just moved it glides there with a little hop. */
export function Piece({ letter, position, materials, slideFrom, onClick, onPointerOver }: PieceProps) {
  const ref = useRef<Group>(null)
  const elapsed = useRef(slideFrom ? 0 : SLIDE_SECONDS)
  const white = letter === letter.toUpperCase()

  useFrame((_, delta) => {
    const group = ref.current
    if (!group || !slideFrom || elapsed.current >= SLIDE_SECONDS) return
    elapsed.current = Math.min(SLIDE_SECONDS, elapsed.current + delta)
    const t = elapsed.current / SLIDE_SECONDS
    const eased = 1 - Math.pow(1 - t, 3)
    group.position.set(
      slideFrom[0] + (position[0] - slideFrom[0]) * eased,
      Math.sin(Math.PI * eased) * 0.45,
      slideFrom[1] + (position[2] - slideFrom[1]) * eased,
    )
  })

  return (
    <group
      ref={ref}
      position={slideFrom ? [slideFrom[0], 0, slideFrom[1]] : position}
      onClick={onClick}
      onPointerOver={onPointerOver}
    >
      <PieceModel
        type={letter.toLowerCase()}
        material={white ? materials.white : materials.black}
        towards={white ? 1 : -1}
      />
    </group>
  )
}
