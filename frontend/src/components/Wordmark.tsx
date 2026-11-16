import { Monogram } from './Monogram'
import styles from './Wordmark.module.css'

// The mark is the BP monogram: a B and a P sharing one stem.
export function Mark({ size = 24 }: { size?: number }) {
  return <Monogram size={size} className={styles.mark} />
}

export function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <Monogram size={40} className={styles.mark} />
      {/* "Board" in the B's red and "Playable" in the P's purple, like the monogram. */}
      <span className={styles.name}>
        <span className={styles.board}>Board</span> <span className={styles.playable}>Playable</span>
      </span>
    </span>
  )
}
