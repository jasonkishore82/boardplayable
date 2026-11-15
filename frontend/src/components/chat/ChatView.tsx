import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { initials } from '../../lib/initials'
import { Avatar } from '../Avatar'
import styles from './ChatView.module.css'

export type ChatLine = {
  id: string
  mine: boolean
  /** Shown above other people's messages. */
  author?: string | null
  body: string
  at: string
  /** Pictures to try for the author, e.g. a computer opponent's portrait. Initials are shown without one. */
  avatar?: string[]
  /** A note from the room rather than a person, shown centred with its time, e.g. "Game 2 started · 20:41". */
  system?: boolean
}

type Props = {
  /** Accessible name for the conversation, e.g. "Chat with ada". */
  label: string
  lines: ChatLine[]
  onSend: (text: string) => Promise<void> | void
  maxLength?: number
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  /** Message shown under the box, e.g. when the connection dropped. */
  note?: string
}

function time(at: string): string {
  const date = new Date(at)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// A conversation: scrolling messages and a box to write in. Used for friend chat and in-game chat.
export function ChatView({
  label,
  lines,
  onSend,
  maxLength = 1000,
  placeholder = 'Write a message',
  emptyText,
  disabled,
  note,
}: Props) {
  const inputId = useId()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // Keep the newest message in view, unless the reader has scrolled up to read.
  useEffect(() => {
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [lines.length])

  function onScroll() {
    const el = logRef.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const body = text.trim()
    if (!body || sending || disabled) return
    setSending(true)
    setError('')
    try {
      await onSend(body)
      setText('')
      stick.current = true
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Couldn’t send that. Try again.')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends. Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className={styles.chat}>
      <div
        ref={logRef}
        className={styles.log}
        role="log"
        aria-label={label}
        aria-live="polite"
        tabIndex={0}
        onScroll={onScroll}
      >
        {lines.length === 0 && emptyText && <p className={styles.empty}>{emptyText}</p>}
        {lines.map((line) => {
          if (line.system) {
            return (
              <p key={line.id} className={styles.system}>
                <span>{line.body}</span>
                <span className={styles.systemTime}>{time(line.at)}</span>
              </p>
            )
          }
          const name = line.mine ? 'You' : (line.author ?? 'Player')
          return (
            <div key={line.id} className={[styles.row, line.mine && styles.mine].filter(Boolean).join(' ')}>
              {!line.mine &&
                (line.avatar ? (
                  <Avatar name={name} src={line.avatar} size={32} />
                ) : (
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(name)}
                  </span>
                ))}
              <div className={styles.card}>
                {!line.mine && <span className={styles.author}>{name}</span>}
                <p className={styles.body}>{line.body}</p>
                <span className={styles.time}>{time(line.at)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <label htmlFor={inputId} className={styles.visuallyHidden}>
          {placeholder}
        </label>
        <textarea
          id={inputId}
          className={styles.input}
          rows={1}
          value={text}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <button type="submit" className={styles.send} disabled={sending || disabled || !text.trim()} aria-label="Send">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />
          </svg>
        </button>
      </form>
      <div aria-live="polite" className={styles.below}>
        {error ? <p className={styles.error}>{error}</p> : note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </div>
  )
}
