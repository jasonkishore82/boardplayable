import type { Mark } from './rules'
import styles from './TicTacToe.module.css'

function MarkIcon({ mark }: { mark: Mark }) {
  return mark === 'X' ? (
    <svg viewBox="0 0 24 24" className={styles.x} aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={styles.o} aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  )
}

type Props = {
  board: (Mark | null)[]
  /** The three winning squares, when someone has won. */
  line: number[] | null
  disabled: (cell: number) => boolean
  onPlay: (cell: number) => void
}

export function Board({ board, line, disabled, onPlay }: Props) {
  return (
    <div className={styles.board} role="group" aria-label="Tic-tac-toe board">
      {board.map((value, cell) => {
        const won = line?.includes(cell)
        return (
          <button
            key={cell}
            type="button"
            className={[styles.cell, won && styles.won, !value && !disabled(cell) && styles.open].filter(Boolean).join(' ')}
            disabled={disabled(cell)}
            onClick={() => onPlay(cell)}
            aria-label={`Square ${cell + 1}, ${value ?? 'empty'}`}
          >
            {value && <MarkIcon mark={value} />}
          </button>
        )
      })}
    </div>
  )
}
