// TEMPORARY: renders one game's 3D scene full-screen with a sample position, for capturing cover images.
import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { scenes } from './three/scenes'

const back = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R'
function fenBoard(fen: string): Record<string, string> {
  const out: Record<string, string> = {}
  fen.split('/').forEach((row, r) => {
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch)
      else out['abcdefgh'[f++] + (8 - r)] = ch
    }
  })
  return out
}

const seat = (id: string) => ({ id, username: id })
const STATES: Record<string, unknown> = {
  'tic-tac-toe': {
    board: ['X', 'O', null, null, 'X', 'O', 'O', null, 'X'].map((m, i) => (i === 8 ? null : m)),
    turn: 'X',
    winner: null,
    line: null,
    round: 1,
    history: ['X5', 'O2', 'X1', 'O6', 'X9'].slice(0, 4).concat('O7'),
    scores: { X: 0, O: 0, draw: 0 },
    seats: { X: seat('a'), O: seat('b') },
  },
  chess: {
    board: fenBoard(back),
    turn: 'white',
    winner: null,
    reason: null,
    legal: {},
    last: ['f8', 'c5'],
    check: null,
    round: 1,
    history: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    scores: { white: 0, black: 0, draw: 0 },
    seats: { white: seat('a'), black: seat('b') },
    live: true,
  },
}

const id = new URLSearchParams(location.search).get('game') ?? 'tic-tac-toe'
const Scene = scenes[id]
createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <Scene game={STATES[id]} myId="spectator" send={() => {}} mode="3d" />
  </Suspense>,
)
