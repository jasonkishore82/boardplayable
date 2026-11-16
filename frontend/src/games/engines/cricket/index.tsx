import type { GameEngineProps } from '../../registry'
import { Lobby } from '../../room/Lobby'
import roomStyles from '../../room/Room.module.css'
import { RoomTable, ScoreBoard } from '../../room/RoomTable'
import { Pitch } from './Pitch'
import { sideLabel, statusLine, type CricketState } from './rules'

const GAME_ID = 'cricket'
const TITLE = 'Cricket'

export default function Cricket({ roomId, bot }: GameEngineProps) {
  if (!roomId) {
    return (
      <Lobby
        gameId={GAME_ID}
        title={TITLE}
        lede="Hand cricket. Each ball, you both pick 1 to 6. Same number and the batter is out; otherwise they score what they picked."
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
