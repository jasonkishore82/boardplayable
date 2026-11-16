import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import DeckScene from './DeckScene'
import styles from './OneCard.module.css'

// One Card's table: for now, the 3D deck (DeckScene.jsx) with a dealt hand of seven you can fan through and flip.
// The rules, turns and online rooms come later. It fills the window over the app like the other 3D games.
export default function OneCard(_: GameEngineProps) {
  return createPortal(
    <div className={styles.app}>
      <DeckScene layout="hand" brand="BP" />
      <Link to="/games" className={styles.leave}>
        <BackArrow /> Games
      </Link>
    </div>,
    document.body,
  )
}
