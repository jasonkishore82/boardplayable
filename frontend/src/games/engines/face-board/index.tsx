import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import styles from './FaceBoard.module.css'
import FaceBoardScene from './FaceBoardScene'

// Face Board: a 3D face-guessing board you fill with your own photos (FaceBoardScene.jsx). Each player keeps a board
// on their own device, picks a secret face and flips frames down as they ask yes-or-no questions. It fills the window
// over the app like the other 3D games; the scene brings its own buttons and tips.
export default function FaceBoard(_: GameEngineProps) {
  return createPortal(
    <div className={styles.app}>
      <FaceBoardScene rows={3} cols={8} sound />
      <Link to="/games" className={styles.leave}>
        <BackArrow /> Games
      </Link>
    </div>,
    document.body,
  )
}
