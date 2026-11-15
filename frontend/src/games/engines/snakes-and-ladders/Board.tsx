import { cellOf, centre, DRAW_ORDER, type Colour, type SnakesState } from './rules'
import styles from './Snakes.module.css'

const TOKENS: Colour[] = ['red', 'blue']

// A squiggle from a snake's head to its tail.
function snakePath(from: number, to: number): string {
  const a = centre(from)
  const b = centre(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const nx = (-dy / length) * 5
  const ny = (dx / length) * 5
  const at = (t: number, side: number) => `${a.x + dx * t + nx * side} ${a.y + dy * t + ny * side}`
  return `M ${a.x} ${a.y} C ${at(0.25, 1)}, ${at(0.5, -1)}, ${b.x} ${b.y} S ${at(0.85, -1)}, ${b.x} ${b.y}`
}

function describe(game: SnakesState): string {
  const at = (c: Colour) => (game.positions[c] ? `on square ${game.positions[c]}` : 'not started')
  return `Snakes and ladders board. Red is ${at('red')}. Blue is ${at('blue')}.`
}

export function Board({ game }: { game: SnakesState }) {
  const ladders = Object.entries(game.ladders).map(([foot, top]) => [Number(foot), top] as const)
  const snakes = Object.entries(game.snakes).map(([head, tail]) => [Number(head), tail] as const)
  const waiting = TOKENS.filter((c) => game.positions[c] === 0)

  return (
    <div className={styles.wrap}>
      <div className={styles.board} role="img" aria-label={describe(game)}>
        {DRAW_ORDER.map((square) => (
          <div
            key={square}
            className={[styles.square, (cellOf(square).col + cellOf(square).row) % 2 ? styles.light : styles.dark].join(' ')}
          >
            <span>{square}</span>
          </div>
        ))}

        <svg className={styles.lines} viewBox="0 0 100 100" aria-hidden="true">
          {ladders.map(([foot, top]) => (
            <line key={`l${foot}`} x1={centre(foot).x} y1={centre(foot).y} x2={centre(top).x} y2={centre(top).y} className={styles.ladder} />
          ))}
          {snakes.map(([head, tail]) => (
            <g key={`s${head}`}>
              <path d={snakePath(head, tail)} className={styles.snake} />
              <circle cx={centre(head).x} cy={centre(head).y} r="1.8" className={styles.head} />
            </g>
          ))}
        </svg>

        {TOKENS.map((colour, index) => {
          const square = game.positions[colour]
          if (!square) return null
          const { x, y } = centre(square)
          const nudge = game.positions.red === game.positions.blue ? (index === 0 ? -1.6 : 1.6) : 0
          return (
            <span
              key={colour}
              className={[styles.token, styles[colour]].join(' ')}
              style={{ left: `${x + nudge}%`, top: `${y}%` }}
              aria-hidden="true"
            />
          )
        })}
      </div>
      <p className={styles.start}>
        {waiting.map((c) => (
          <span key={c} className={[styles.token, styles.inline, styles[c]].join(' ')} aria-hidden="true" />
        ))}
        {waiting.length > 0 ? 'Not on the board yet' : ''}
      </p>
    </div>
  )
}
