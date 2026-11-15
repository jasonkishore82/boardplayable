import { useState } from 'react'
import { Logo } from './Logo'
import styles from './Wordmark.module.css'

// The mark is the matte Board Playable logo.
export function Mark({ size = 24 }: { size?: number }) {
  return <Logo size={size} className={styles.mark} />
}

export function Wordmark() {
  const [hovered, setHovered] = useState<boolean | undefined>(undefined)
  return (
    <span className={styles.wordmark} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Logo size={24} className={styles.mark} rolling={hovered} />
      <span>Board Playable</span>
    </span>
  )
}
