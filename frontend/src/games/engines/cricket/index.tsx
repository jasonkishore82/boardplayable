import { Navigate, useSearchParams } from 'react-router-dom'
import type { GameEngineProps } from '../../registry'
import { Lobby } from '../../room/Lobby'
import roomStyles from '../../room/Room.module.css'
import { RoomTable, ScoreBoard } from '../../room/RoomTable'
import { Pitch } from './Pitch'
import { sideLabel, statusLine, type CricketState } from './rules'

// Hand Cricket: online or against a bot, each ball both players pick 1 to 6. Its rooms and bots run on the API under
// the id 'cricket', so the game keeps that id. The 3D nets are their own game now (engines/cricket-nets), though their
// code still lives in ./nets.

const GAME_ID = 'cricket'
const TITLE = 'Hand Cricket'

export default function HandCricket({ roomId, bot }: GameEngineProps) {
  const [params] = useSearchParams()
  // old links to the nets went through here
  if (params.get('mode') === 'nets') return <Navigate to="/games/cricket-nets" replace />
  if (!roomId) {
    return (
      <Lobby
        gameId={GAME_ID}
        title={TITLE}
        lede="Each ball, you both pick 1 to 6. Same number and the batter is out; otherwise they score what they picked."
        bots
      />
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
