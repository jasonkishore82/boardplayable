import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '../Button'
import styles from './ChatView.module.css'

export type ChatLine = {
  id: string
  mine: boolean
  /** Shown above other people's messages. */
  author?: string | null
  body: string
  at: string
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
export function ChatView({ label, lines, onSend, maxLength = 1000, placeholder = 'Write a message', emptyText, disabled, note }: Props) {
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
        {lines.map((line, i) => {
          const sameAuthor = i > 0 && lines[i - 1].mine === line.mine && lines[i - 1].author === line.author
          return (
            <div key={line.id} className={[styles.row, line.mine && styles.mine].filter(Boolean).join(' ')}>
              {!line.mine && line.author && !sameAuthor && <span className={styles.author}>{line.author}</span>}
              <p className={styles.bubble}>{line.body}</p>
              <span className={styles.time}>{time(line.at)}</span>
            </div>
          )
        })}
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <label htmlFor="chat-input" className={styles.visuallyHidden}>
          {placeholder}
        </label>
        <textarea
          id="chat-input"
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
        <Button type="submit" loading={sending} disabled={disabled || !text.trim()}>
          Send
        </Button>
      </form>
      <div aria-live="polite" className={styles.below}>
        {error ? <p className={styles.error}>{error}</p> : note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </div>
  )
}
