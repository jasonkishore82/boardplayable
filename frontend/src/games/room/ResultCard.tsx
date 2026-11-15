import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'
import type { ResultInfo } from './result'
import styles from './ResultCard.module.css'

type Props = {
  result: ResultInfo
  /** Only the seated players can start a rematch. */
  onRematch?: () => void
  onExport?: () => void
  exporting?: boolean
  onClose: () => void
  /** Inside the full-screen board instead of over the whole page. */
  contained?: boolean
}

// The card that pops up when a game ends: "Checkmate", who won, and what to do next.
export function ResultCard({ result, onRematch, onExport, exporting, onClose, contained }: Props) {
  const card = useRef<HTMLDivElement>(null)

  // Focus the first button so the keyboard (and a controller) can act at once, and let Escape close the card.
  useEffect(() => {
    card.current?.querySelector('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={[styles.backdrop, contained && styles.contained].filter(Boolean).join(' ')}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      data-export-skip=""
    >
      <div
        ref={card}
        className={styles.card}
        data-tone={result.tone}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        aria-describedby="result-detail"
      >
        <div className={styles.icon} aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            {result.tone === 'draw' ? (
              <path d="M5 9h14M5 15h14" />
            ) : (
              <>
                <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
                <path d="M5 19h14" />
              </>
            )}
          </svg>
        </div>
        <h2 id="result-title" className={styles.title}>
          {result.title}
        </h2>
        <p id="result-detail" className={styles.detail}>
          {result.detail}
        </p>
        {result.meta && <p className={styles.meta}>{result.meta}</p>}

        <div className={styles.actions}>
          {onRematch && (
            <Button block onClick={onRematch}>
              Play again
            </Button>
          )}
          <div className={styles.row}>
            <Button variant="secondary" block onClick={onClose}>
              View board
            </Button>
            {onExport && (
              <Button variant="secondary" block loading={exporting} disabled={exporting} onClick={onExport}>
                Export PDF
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
