import { useRef, useState, type PointerEvent } from 'react'
import { glyph, isDark, pieceColor, pieceName, squaresInOrder, type ChessState } from './rules'
import styles from './Chess.module.css'

type Props = {
  game: ChessState
  /** Draw black at the bottom (when you are playing black). */
  flipped: boolean
  selected: string | null
  /** Squares the selected piece can move to. */
  targets: string[]
  /** Whether the player may pick this square right now. */
  enabled: (square: string) => boolean
  onSquare: (square: string) => void
}

/** A piece being dragged: where it came from, the pointer, and the size to draw it at. */
type Drag = { from: string; x: number; y: number; size: number; moved: boolean; startX: number; startY: number }

const DRAG_DISTANCE = 6 // pixels the pointer must travel before a press counts as a drag, not a click

export function Board({ game, flipped, selected, targets, enabled, onSquare }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null)
  // A press on a piece selects it at once (so a drag starts from a selected piece). The click that follows must not
  // select it a second time, which would deselect it.
  const skipClick = useRef(false)

  function pressStart(event: PointerEvent<HTMLButtonElement>, square: string) {
    if (event.button !== 0 || !game.board[square] || !game.legal[square] || !enabled(square)) return
    if (square !== selected) onSquare(square)
    skipClick.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const size = parseFloat(getComputedStyle(event.currentTarget).fontSize) || 40
    setDrag({
      from: square,
      x: event.clientX,
      y: event.clientY,
      size,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    })
  }

  function pressMove(event: PointerEvent<HTMLButtonElement>) {
    setDrag((d) => {
      if (!d) return d
      const moved = d.moved || Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > DRAG_DISTANCE
      return { ...d, x: event.clientX, y: event.clientY, moved }
    })
  }

  function pressEnd(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const d = drag
    setDrag(null)
    // The click event (if any) comes right after this, so the flag is cleared a moment later.
    window.setTimeout(() => {
      skipClick.current = false
    }, 0)
    if (!d || !d.moved || cancelled) return
    const under = document.elementFromPoint(event.clientX, event.clientY)
    const to = under?.closest<HTMLElement>('[data-square]')?.dataset.square
    if (to && to !== d.from && targets.includes(to)) onSquare(to)
  }

  const dragging = drag?.moved ? drag : null
  const dragged = dragging ? game.board[dragging.from] : undefined

  return (
    <div className={styles.board} role="group" aria-label="Chess board">
      {squaresInOrder(flipped).map((square, index) => {
        const piece = game.board[square]
        const target = targets.includes(square)
        const classes = [
          styles.square,
          isDark(square) ? styles.dark : styles.light,
          square === selected && styles.selected,
          game.last?.includes(square) && styles.last,
          square === game.check && styles.check,
          target && styles.target,
          target && piece && styles.capture,
          enabled(square) && styles.open,
          dragging?.from === square && styles.dragging,
        ]
        return (
          <button
            key={square}
            type="button"
            className={classes.filter(Boolean).join(' ')}
            data-square={square}
            disabled={!enabled(square)}
            onPointerDown={(event) => pressStart(event, square)}
            onPointerMove={pressMove}
            onPointerUp={(event) => pressEnd(event, false)}
            onPointerCancel={(event) => pressEnd(event, true)}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false
                return
              }
              onSquare(square)
            }}
            aria-label={`${square}, ${piece ? pieceName(piece) : 'empty'}${target ? ', you can move here' : ''}`}
            aria-pressed={square === selected}
          >
            {index % 8 === 0 && (
              <span className={[styles.coord, styles.rank].join(' ')} aria-hidden="true">
                {square[1]}
              </span>
            )}
            {index >= 56 && (
              <span className={[styles.coord, styles.file].join(' ')} aria-hidden="true">
                {square[0]}
              </span>
            )}
            {piece && (
              <span className={pieceColor(piece) === 'white' ? styles.white : styles.black} aria-hidden="true">
                {glyph(piece)}
              </span>
            )}
          </button>
        )
      })}
      {dragging && dragged && (
        <span
          className={[styles.ghost, pieceColor(dragged) === 'white' ? styles.white : styles.black].join(' ')}
          style={{ left: dragging.x, top: dragging.y, fontSize: dragging.size * 1.1 }}
          aria-hidden="true"
        >
          {glyph(dragged)}
        </span>
      )}
    </div>
  )
}
