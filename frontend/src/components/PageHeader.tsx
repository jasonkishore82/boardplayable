import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      {children && <p className={styles.sub}>{children}</p>}
    </header>
  )
}
