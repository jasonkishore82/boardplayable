import styles from './Wordmark.module.css'

// The mark is a 2x2 board with two filled squares.
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={styles.mark}>
      <rect x="1" y="1" width="18" height="18" rx="5" fill="currentColor" />
      <rect x="5" y="5" width="5" height="5" fill="var(--bg)" />
      <rect x="10" y="10" width="5" height="5" fill="var(--bg)" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <Mark />
      <span>Board Playable</span>
    </span>
  )
}
