import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import { canPlay, type TttState } from '../../games/engines/tic-tac-toe/rules'
import { GameCanvas } from '../GameCanvas'
import { CameraRig, COLORS, Floor, SceneLights, type SceneProps } from './shared'

const SPACING = 1.5

/** Tile 0 to 8 to a place on the board: three columns along x, three rows along z. */
const cellXZ = (cell: number): [number, number] => [((cell % 3) - 1) * SPACING, (Math.floor(cell / 3) - 1) * SPACING]

/** A tic-tac-toe board in 3D. In 3D view you can play on it; in cinematic view it is for watching. */
export default function TicTacToeScene({ game: raw, myId, send, mode }: SceneProps) {
  const game = raw as TttState
  const cinematic = mode === 'cinematic'
  const [hover, setHover] = useState<number | null>(null)

  // The square played last, from the history entries like "X5".
  const lastEntry = game.history?.at(-1)
  const lastCell = lastEntry ? Number(lastEntry.slice(1)) - 1 : null
  const focus: [number, number, number] = lastCell !== null && lastCell >= 0 ? [cellXZ(lastCell)[0], 0, cellXZ(lastCell)[1]] : [0, 0, 0]

  return (
    <GameCanvas camera={{ position: [0, 6, 7], fov: 38 }}>
      <fog attach="fog" args={['#ffffff', 14, 28]} />
      <SceneLights mode={mode} />
      <Floor radius={11} />
      <CameraRig mode={mode} focus={focus} distance={6.6} />

      {/* The slab the game is played on. */}
      <mesh position={[0, -0.14, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.1, 0.28, 5.1]} />
        <meshStandardMaterial color={COLORS.frame} roughness={0.35} metalness={0.5} />
      </mesh>

      {game.board.map((value, cell) => {
        const [x, z] = cellXZ(cell)
        const winning = game.line?.includes(cell) ?? false
        const playable = !cinematic && canPlay(game, myId, cell)
        const lit = winning || (playable && hover === cell)
        return (
          <group key={cell} position={[x, 0, z]}>
            <mesh
              position={[0, 0.0, 0]}
              receiveShadow
              onClick={(event: ThreeEvent<MouseEvent>) => {
                if (event.delta > 6 || !playable) return // a drag to turn the board, or not your move
                event.stopPropagation()
                send({ type: 'move', cell })
              }}
              onPointerOver={(event: ThreeEvent<PointerEvent>) => {
                setHover(cell)
                const canvas = event.nativeEvent.target as HTMLElement | null
                if (canvas) canvas.style.cursor = playable ? 'pointer' : cinematic ? 'default' : 'grab'
              }}
              onPointerOut={() => setHover((current) => (current === cell ? null : current))}
            >
              <boxGeometry args={[1.38, 0.18, 1.38]} />
              <meshStandardMaterial
                color={winning ? COLORS.gold : lit ? COLORS.accent : COLORS.dark}
                emissive={winning ? COLORS.gold : lit ? COLORS.accent : '#000000'}
                emissiveIntensity={winning ? 0.5 : lit ? 0.35 : 0}
                roughness={0.4}
                metalness={0.2}
              />
            </mesh>
            {value && <Mark mark={value} glowing={winning} />}
          </group>
        )
      })}
    </GameCanvas>
  )
}

/** An X or an O that pops up when it is placed. */
function Mark({ mark, glowing }: { mark: 'X' | 'O'; glowing: boolean }) {
  const ref = useRef<Group>(null)
  const age = useRef(0)
  const color = mark === 'X' ? COLORS.accent : COLORS.pink

  useFrame((state, delta) => {
    const group = ref.current
    if (!group) return
    age.current += delta
    // Pop in with a little overshoot, then breathe gently if it is part of the winning line.
    const t = Math.min(age.current / 0.35, 1)
    const overshoot = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.25 : 1
    const pulse = glowing ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.06 : 1
    group.scale.setScalar(Math.max(0.0001, t * overshoot * pulse))
  })

  const material = (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glowing ? 0.9 : 0.45} roughness={0.3} metalness={0.3} />
  )

  return (
    <group ref={ref} position={[0, 0.31, 0]} scale={0.0001}>
      {mark === 'X' ? (
        <>
          <mesh rotation-y={Math.PI / 4} castShadow>
            <boxGeometry args={[1.0, 0.22, 0.22]} />
            {material}
          </mesh>
          <mesh rotation-y={-Math.PI / 4} castShadow>
            <boxGeometry args={[1.0, 0.22, 0.22]} />
            {material}
          </mesh>
        </>
      ) : (
        <mesh rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[0.36, 0.115, 20, 48]} />
          {material}
        </mesh>
      )}
    </group>
  )
}
