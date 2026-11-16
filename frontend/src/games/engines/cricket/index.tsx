import { Suspense, lazy } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { GameEngineProps } from '../../registry'
import { Lobby } from '../../room/Lobby'
import roomStyles from '../../room/Room.module.css'
import { RoomTable, ScoreBoard } from '../../room/RoomTable'
import { Pitch } from './Pitch'
import { sideLabel, statusLine, type CricketState } from './rules'
import styles from './Cricket.module.css'

// The 3D nets (a bowling machine, a full-size pitch and a bat you swing with your phone) load on demand, so the
// hand-cricket table never downloads them.
const Nets = lazy(() => import('./nets/Nets'))

const GAME_ID = 'cricket'
const TITLE = 'Cricket'

export default function Cricket({ roomId, bot }: GameEngineProps) {
  const [params] = useSearchParams()
  if (params.get('mode') === 'nets') {
    return (
      <Suspense fallback={<p className={styles.loadingNets}>Setting up the nets…</p>}>
        <Nets />
      </Suspense>
    )
  }
  if (!roomId) {
    return (
      <Lobby
        gameId={GAME_ID}
        title={TITLE}
        lede="Hand cricket. Each ball, you both pick 1 to 6. Same number and the batter is out; otherwise they score what they picked."
        bots
      >
        <Link to="/games/cricket?mode=nets" className={styles.netsCard}>
          <span className={styles.netsBadge}>3D</span>
          <b>Practise in the nets</b>
          <span>Face a bowling machine on a full-size pitch. Swing with the mouse, or use your phone as the bat.</span>
        </Link>
      </Lobby>
    )
  }
  return (
    <RoomTable<CricketState>
      gameId={GAME_ID}
      title={TITLE}
      code={roomId}
      bot={bot}
      sideTitle="Matches won"
      scores={({ game }) => (
        <ScoreBoard
          entries={[
            { label: game.seats.home?.username ?? sideLabel('home'), value: game.scores.home },
            { label: 'Draws', value: game.scores.draw },
            { label: game.seats.away?.username ?? sideLabel('away'), value: game.scores.away },
          ]}
        />
      )}
    >
      {({ game, myId, send }) => (
        <>
          <p className={roomStyles.status} aria-live="polite">
            {statusLine(game, myId)}
          </p>
          <Pitch game={game} myId={myId} onPick={(pick) => send({ type: 'move', pick })} />
        </>
      )}
    </RoomTable>
  )
}
