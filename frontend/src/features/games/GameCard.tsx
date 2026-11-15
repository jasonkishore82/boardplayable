import { Link } from 'react-router-dom'
import type { Game } from '../../games/catalog'
import { GameGlyph } from '../../games/GameGlyph'
import styles from './GameCard.module.css'

type Props = {
  game: Game
  /** The tile the home screen is describing: it is larger and outlined. */
  focused: boolean
  /** Called when the tile is pointed at or focused. */
  onFocus: () => void
}

// One square tile in the row of games on the home screen.
export function GameCard({ game, focused, onFocus }: Props) {
  const soon = game.status === 'coming-soon'
  return (
    <Link
      to={`/games/${game.id}`}
      className={[styles.card, focused && styles.focused, soon && styles.soon].filter(Boolean).join(' ')}
      aria-label={`${game.name}${soon ? ', coming soon' : ''}. ${game.description}`}
      onMouseEnter={onFocus}
      onFocus={onFocus}
    >
      <GameGlyph id={game.id} size={64} />
      <span className={styles.name}>{game.name}</span>
    </Link>
  )
}
