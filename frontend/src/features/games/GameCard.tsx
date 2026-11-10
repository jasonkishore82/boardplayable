import { Link } from 'react-router-dom'
import { formatPlayers, type Game } from '../../games/catalog'
import { GameGlyph } from '../../games/GameGlyph'
import styles from './GameCard.module.css'

export function GameCard({ game }: { game: Game }) {
  const soon = game.status === 'coming-soon'
  return (
    <Link to={`/games/${game.id}`} className={styles.card}>
      <div className={styles.top}>
        <span className={styles.glyph}>
          <GameGlyph id={game.id} />
        </span>
        {soon && <span className={styles.badge}>Coming soon</span>}
      </div>
      <h3 className={styles.name}>{game.name}</h3>
      <p className={styles.description}>{game.description}</p>
      <p className={styles.players}>{formatPlayers(game.players)}</p>
    </Link>
  )
}
