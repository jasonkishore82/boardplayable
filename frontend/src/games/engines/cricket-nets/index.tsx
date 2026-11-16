import { Suspense, lazy } from 'react'
import type { GameEngineProps } from '../../registry'
import styles from './CricketNets.module.css'

// Cricket Nets: single-player batting in 3D against a bowling machine, with the mouse or a phone as the bat. Its code
// lives in ../cricket/nets (it grew up inside the Cricket game); this is its own entry in the game list. The nets are
// big (models, physics), so they load on demand.
const Nets = lazy(() => import('../cricket/nets/Nets'))

export default function CricketNets(_: GameEngineProps) {
  return (
    <Suspense fallback={<p className={styles.loading}>Setting up the nets…</p>}>
      <Nets />
    </Suspense>
  )
}
