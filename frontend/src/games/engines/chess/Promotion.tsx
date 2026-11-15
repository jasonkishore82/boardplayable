import { useEffect, useRef } from 'react'
import { glyph, type Color } from './rules'
import styles from './Chess.module.css'

const CHOICES = [
  { letter: 'q', name: 'Queen' },
  { letter: 'r', name: 'Rook' },
  { letter: 'b', name: 'Bishop' },
  { letter: 'n', name: 'Knight' },
]

type Props = {
  /** The colour of the pawn, so the pieces on offer are drawn in it. */
  color: Color
  /** Called with the piece letter the server expects: "q", "r", "b" or "n". */
  onPick: (letter: string) => void
  /** Closes the pop-up without moving, so the player can choose a different move. */
  onCancel: () => void
}

// The pop-up shown when a pawn reaches the far end of the board: pick the piece it becomes.
// It covers the element it is placed in, which must be positioned (the flat board's area, or the 3D stage).
export function PromotionPicker({ color, onPick, onCancel }: Props) {
  const card = useRef<HTMLDivElement>(null)
  const cancel = useRef(onCancel)
  cancel.current = onCancel

  // Focus the first choice so the keyboard can act at once, and let Escape close the pop-up.
  useEffect(() => {
    card.current?.querySelector('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={styles.promoBackdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      data-export-skip=""
    >
      <div ref={card} className={styles.promo} role="dialog" aria-modal="true" aria-labelledby="promo-title">
        <p id="promo-title" className={styles.promoTitle}>
          Promote your pawn
        </p>
        <div className={styles.promoChoices}>
          {CHOICES.map((choice) => (
            <button key={choice.letter} type="button" className={styles.promoChoice} onClick={() => onPick(choice.letter)}>
              <span
                className={[styles.promoPiece, color === 'white' ? styles.white : styles.black].join(' ')}
                aria-hidden="true"
              >
                {glyph(choice.letter)}
              </span>
              <span className={styles.promoName}>{choice.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.promoCancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
