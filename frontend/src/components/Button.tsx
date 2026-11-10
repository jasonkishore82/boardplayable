import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  loading?: boolean
  block?: boolean
}

export function Button({ variant = 'primary', loading, block, disabled, children, className, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={[styles.button, styles[variant], block && styles.block, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <span className={loading ? styles.hidden : undefined}>{children}</span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  )
}
