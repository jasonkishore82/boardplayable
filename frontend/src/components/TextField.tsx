import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './TextField.module.css'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  trailing?: ReactNode
}

export function TextField({ label, error, hint, trailing, id, ...input }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const message = error ?? hint

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        {...input}
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
      />
      {(message || trailing) && (
        <div className={styles.below}>
          {message ? (
            <p id={messageId} className={error ? styles.error : styles.hint}>
              {message}
            </p>
          ) : (
            <span />
          )}
          {trailing}
        </div>
      )}
    </div>
  )
}
