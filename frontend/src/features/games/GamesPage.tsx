import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { GAMES, formatPlayers, groupByCategory, type CategoryId } from '../../games/catalog'
import { GameCard } from './GameCard'
import styles from './GamesPage.module.css'

const CATEGORIES = groupByCategory()

// The home screen, laid out like a console's: the backdrop picture fills the window (the app shell draws it), the
// game you are pointing at is described over it, and every game sits in one row along the bottom.
export function GamesPage() {
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const [focusedId, setFocusedId] = useState(GAMES[0]?.id)
  const row = useRef<HTMLUListElement>(null)

  const games = category === 'all' ? GAMES : (CATEGORIES.find((c) => c.id === category)?.games ?? GAMES)
  const focused = games.find((game) => game.id === focusedId) ?? games[0]
  const categoryLabel = CATEGORIES.find((c) => c.id === focused.category)?.label
  const focusedIndex = games.indexOf(focused)

  // Tells the backdrop where the selection is in the row, so the picture slides a little as it moves.
  useEffect(() => {
    document.documentElement.style.setProperty('--backdrop-shift', String(focusedIndex))
    return () => {
      document.documentElement.style.removeProperty('--backdrop-shift')
    }
  }, [focusedIndex])

  // Left and right arrows move along the row.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const tiles = Array.from(row.current?.querySelectorAll<HTMLElement>('a') ?? [])
    const next = tiles[tiles.indexOf(document.activeElement as HTMLElement) + (event.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    event.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div className={styles.page} data-home="">
      <h1 className="visually-hidden">Games</h1>

      <div className={styles.filters} role="group" aria-label="Show games">
        {[{ id: 'all' as const, label: 'All' }, ...CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            className={[styles.filter, category === c.id && styles.filterActive].filter(Boolean).join(' ')}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Keyed by the game, so the details animate in each time the selection changes. */}
      <section key={focused.id} className={styles.info} aria-label="Selected game">
        <h2 className={styles.name}>{focused.name}</h2>
        <p className={styles.description}>{focused.description}</p>
        <p className={styles.meta}>
          {[categoryLabel, formatPlayers(focused.players)].filter(Boolean).join(' · ')}
        </p>
        {focused.status === 'available' ? (
          <Link to={`/games/${focused.id}`} className={styles.play}>
            Play
          </Link>
        ) : (
          <span className={styles.soon}>Coming soon</span>
        )}
      </section>

      {/* Keyed by the filter, so the tiles slide in again when it changes. --i staggers them. */}
      <ul key={category} className={styles.row} ref={row} onKeyDown={onKeyDown}>
        {games.map((game, index) => (
          <li key={game.id} style={{ '--i': index } as CSSProperties}>
            <GameCard game={game} focused={game.id === focused.id} onFocus={() => setFocusedId(game.id)} />
          </li>
        ))}
      </ul>
    </div>
  )
}
