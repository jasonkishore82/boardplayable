import type { ReactNode } from 'react'
import styles from './Section.module.css'

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.head}>
        <h2 id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function SoonTag() {
  return <span className={styles.soon}>Coming soon</span>
}
