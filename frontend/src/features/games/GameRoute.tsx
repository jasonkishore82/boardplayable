import { lazy, Suspense, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { formatPlayers, getGame } from '../../games/catalog'
import { GameGlyph } from '../../games/GameGlyph'
import { engines } from '../../games/registry'
import styles from './GameRoute.module.css'

// /games/:gameId. Loads the game's engine when it has one, otherwise shows its details.
export function GameRoute() {
  const { gameId } = useParams()
  const game = getGame(gameId)
  const loader = game && game.status === 'available' ? engines[game.id] : undefined
  const Engine = useMemo(() => (loader ? lazy(loader) : null), [loader])

  if (!game) return <Navigate to="/games" replace />

  if (Engine) {
    return (
      <Suspense fallback={<p className={styles.loading}>Setting up the table…</p>}>
        <Engine gameId={game.id} />
      </Suspense>
    )
  }

  return (
    <article className={styles.detail}>
      <Link to="/games" className={styles.back}>
        <span aria-hidden="true">←</span> Games
      </Link>
      <div className={styles.glyph}>
        <GameGlyph id={game.id} size={72} />
      </div>
      <h1>{game.name}</h1>
      <p className={styles.description}>{game.description}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Players</dt>
          <dd>{formatPlayers(game.players)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Coming soon</dd>
        </div>
      </dl>
      <p className={styles.note}>We’re still building this table. It will show up here the moment it’s ready.</p>
    </article>
  )
}
