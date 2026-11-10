import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { LatheGeometry, Vector2, type Group } from 'three'
import { GameCanvas } from './GameCanvas'

// A single chess pawn on a small patch of board. Turns slowly; still when reduced motion is on.

// Outline of a Staunton-style pawn, spun around the y axis. The head is a smooth arc.
function pawnProfile(): Vector2[] {
  const body: [number, number][] = [
    [0, 0], [0.62, 0], [0.62, 0.08], [0.55, 0.13], [0.56, 0.19], [0.42, 0.28], [0.31, 0.46],
    [0.23, 0.9], [0.21, 1.08], [0.36, 1.13], [0.36, 1.19], [0.2, 1.25],
  ]
  const points = body.map(([x, y]) => new Vector2(x, y))
  const r = 0.3
  const cy = 1.25 + r * 0.9
  const start = Math.asin(-0.9)
  for (let i = 0; i <= 24; i++) {
    const a = start + ((Math.PI / 2 - start) * i) / 24
    points.push(new Vector2(Math.max(r * Math.cos(a), 0), cy + r * Math.sin(a)))
  }
  return points
}

function Pawn({ color }: { color: string }) {
  const geometry = useMemo(
    () => new LatheGeometry(pawnProfile(), 96),
    [],
  )
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.45} metalness={0} />
    </mesh>
  )
}

function Board({ light, dark }: { light: string; dark: string }) {
  const squares = []
  for (let x = -2; x < 2; x++) {
    for (let z = -2; z < 2; z++) {
      squares.push(
        <mesh key={`${x}${z}`} position={[x + 0.5, -0.05, z + 0.5]} receiveShadow>
          <boxGeometry args={[1, 0.1, 1]} />
          <meshStandardMaterial color={(x + z) % 2 === 0 ? light : dark} roughness={0.8} />
        </mesh>,
      )
    }
  }
  return (
    <group>
      {squares}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.16, 4.2]} />
        <meshStandardMaterial color={light} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Scene({ dark, still }: { dark: boolean; still: boolean }) {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!still && group.current) group.current.rotation.y += delta * 0.12
  })
  const palette = dark
    ? { light: '#3a3a37', dark: '#1f5c45', pawn: '#e6e4de' }
    : { light: '#ecebe6', dark: '#2c6b53', pawn: '#fbfaf7' }

  return (
    <>
      <ambientLight intensity={dark ? 0.5 : 0.8} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={dark ? 1.6 : 2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={6}
      />
      <group ref={group} rotation={[0, 0.6, 0]}>
        <Board light={palette.light} dark={palette.dark} />
        <group position={[0.5, 0, 0.5]}>
          <Pawn color={palette.pawn} />
        </group>
      </group>
    </>
  )
}

export default function PieceScene() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <GameCanvas camera={{ position: [0, 6.2, 10.5], fov: 28 }} onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}>
      <Scene dark={dark} still={still} />
    </GameCanvas>
  )
}
