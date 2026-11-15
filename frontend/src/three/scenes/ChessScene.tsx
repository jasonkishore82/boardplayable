import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { PromotionPicker } from '../../games/engines/chess/Promotion'
import { isPromotion, lostPieces, myColor, type ChessState } from '../../games/engines/chess/rules'
import { GameCanvas } from '../GameCanvas'
import { CHESS, Chessboard } from './chessboard/Chessboard'
import { Piece, usePieceMaterials } from './chessPieces'
import { CameraRig, COLORS, Floor, SceneLights, type SceneProps } from './shared'

const FILES = 'abcdefgh'

/** Where a square is in the scene: files run along x, ranks along z, white at the +z end. */
const squareXZ = (square: string): [number, number] => [FILES.indexOf(square[0]) - 3.5, 4.5 - Number(square[1])]

const ALL_SQUARES = FILES.split('').flatMap((file) => [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => `${file}${rank}`))

// The wooden board is modelled in metres; scaled so one square is one scene unit, its veneer at y = 0.
const BOARD_SCALE = 1 / CHESS.cell
const BOARD_Y = -CHESS.top * BOARD_SCALE
const FLOOR_Y = BOARD_Y - 0.004

/** A chess board in 3D. In 3D view you can play on it; in cinematic view it is for watching. */
export default function ChessScene({ game: raw, myId, send, mode }: SceneProps) {
  const game = raw as ChessState
  const mine = myColor(game, myId)
  const flipped = mine === 'black'
  const cinematic = mode === 'cinematic'
  const [selected, setSelected] = useState<string | null>(null)
  // A pawn move to the far end that is waiting for the player to choose what the pawn becomes.
  const [promoting, setPromoting] = useState<{ from: string; to: string } | null>(null)
  const materials = usePieceMaterials(cinematic)

  const bothSeated = !!game.seats.white && !!game.seats.black
  const myTurn = !cinematic && !!mine && mine === game.turn && !game.winner && bothSeated
  const targets = myTurn && selected ? (game.legal[selected] ?? []) : []

  useEffect(() => {
    if (!myTurn) setSelected(null)
  }, [myTurn])

  function pick(square: string) {
    if (!myTurn) return
    if (selected && targets.includes(square)) {
      // A pawn reaching the far end asks what it should become before the move is sent.
      if (isPromotion(game.board, selected, square)) setPromoting({ from: selected, to: square })
      else send({ type: 'move', from: selected, to: square })
      setSelected(null)
    } else if (game.legal[square] && square !== selected) {
      setSelected(square)
    } else {
      setSelected(null)
    }
  }

  const focus = useMemo<[number, number, number]>(() => {
    if (!game.last) return [0, 0, 0]
    const [fx, fz] = squareXZ(game.last[0])
    const [tx, tz] = squareXZ(game.last[1])
    return [(fx + tx) / 2, 0, (fz + tz) / 2]
  }, [game.last])

  const canClick = (square: string) => myTurn && (!!game.legal[square] || targets.includes(square))

  function handlers(square: string) {
    return {
      onClick: (event: ThreeEvent<MouseEvent>) => {
        if (event.delta > 6) return // that was a drag to turn the board, not a click
        event.stopPropagation()
        pick(square)
      },
      onPointerOver: (event: ThreeEvent<PointerEvent>) => {
        const canvas = event.nativeEvent.target as HTMLElement | null
        if (canvas) canvas.style.cursor = canClick(square) ? 'pointer' : cinematic ? 'default' : 'grab'
      },
    }
  }

  return (
    <>
      {promoting && myTurn && mine && (
        <PromotionPicker
          color={mine}
          onPick={(promotion) => {
            send({ type: 'move', ...promoting, promotion })
            setPromoting(null)
          }}
          onCancel={() => setPromoting(null)}
        />
      )}
      <GameCanvas camera={{ position: [0, 9, 10], fov: 38 }}>
      <fog attach="fog" args={['#ffffff', 18, 34]} />
      <SceneLights mode={mode} />
      <Floor y={FLOOR_Y} />
      <CameraRig mode={mode} flipped={flipped} focus={focus} distance={9.6} />

      {/* The inlaid wooden board: walnut and maple veneer in a mitred, lacquered frame. */}
      <group position-y={BOARD_Y} scale={BOARD_SCALE}>
        <Chessboard />
      </group>
      {/* The 64 squares you click: invisible, lying just on the veneer. */}
      {ALL_SQUARES.map((square) => {
        const [x, z] = squareXZ(square)
        return (
          <mesh key={square} position={[x, 0.002, z]} rotation-x={-Math.PI / 2} {...handlers(square)}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )
      })}

      {/* Highlights: the last move, a king in check, the piece you picked, and where it can go. */}
      {game.last?.map((square) => (
        <Marker key={`last-${square}`} square={square} color={COLORS.gold} opacity={0.42} />
      ))}
      {game.check && <Marker square={game.check} color={COLORS.danger} opacity={0.6} />}
      {selected && <Marker square={selected} color={COLORS.accent} opacity={0.55} />}
      {targets.map((square) => {
        const [x, z] = squareXZ(square)
        return (
          <mesh key={`target-${square}`} position={[x, 0.03, z]}>
            <cylinderGeometry args={[0.16, 0.16, 0.05, 24]} />
            <meshBasicMaterial color={COLORS.accent} transparent opacity={0.85} />
          </mesh>
        )
      })}

      {Object.entries(game.board).map(([square, letter]) => {
        const [x, z] = squareXZ(square)
        const arrivedHere = game.last && game.last[1] === square
        const from = arrivedHere && game.last ? squareXZ(game.last[0]) : null
        return (
          <Piece
            key={`${square}-${letter}`}
            letter={letter}
            position={[x, 0, z]}
            materials={materials}
            slideFrom={from}
            {...handlers(square)}
          />
        )
      })}
      <Captured game={game} materials={materials} />
      </GameCanvas>
    </>
  )
}

/**
 * The pieces that have been taken, standing on the floor beside the board: white's lost pieces on the left, black's
 * on the right, two columns each, in the order they started (pawns first).
 */
function Captured({ game, materials }: { game: ChessState; materials: ReturnType<typeof usePieceMaterials> }) {
  const sides = [
    { pieces: lostPieces(game.board, 'white'), x: -5.7 },
    { pieces: lostPieces(game.board, 'black'), x: 5.7 },
  ]
  return (
    <>
      {sides.flatMap(({ pieces, x }) =>
        pieces.map((letter, i) => {
          const column = i % 2
          const row = Math.floor(i / 2)
          // Rows run from white's end of the board toward black's.
          const position: [number, number, number] = [x + (x < 0 ? -column : column) * 0.85, FLOOR_Y, 3.6 - row * 0.9]
          return (
            <group key={`${letter}-${i}`} scale={0.8} position={position}>
              <Piece letter={letter} position={[0, 0, 0]} materials={materials} />
            </group>
          )
        }),
      )}
    </>
  )
}

function Marker({ square, color, opacity }: { square: string; color: string; opacity: number }) {
  const [x, z] = squareXZ(square)
  return (
    <mesh position={[x, 0.006, z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[0.97, 0.97]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}
