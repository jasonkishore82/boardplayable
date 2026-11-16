import { Suspense, lazy } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import styles from './Roulette.module.css'

// Roulette: a full-size single-zero table with a simulated wheel (roulette/RouletteScene.jsx). Single player: bet
// chips on the cloth and spin. It fills the window over the app like the other 3D games.
const RouletteScene = lazy(() => import('./roulette/RouletteScene'))

export default function Roulette(_: GameEngineProps) {
  return createPortal(
    <div className={styles.app}>
      <Suspense fallback={<p className={styles.loading}>Setting up the table…</p>}>
        <RouletteScene />
      </Suspense>
      <Link to="/games" className={styles.leave}>
        <BackArrow /> Games
      </Link>
    </div>,
    document.body,
  )
}
