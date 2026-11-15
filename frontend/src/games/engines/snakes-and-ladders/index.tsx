import { Button } from '../../../components/Button'
import type { GameEngineProps } from '../../registry'
import { Lobby } from '../../room/Lobby'
import roomStyles from '../../room/Room.module.css'
import { RoomTable, ScoreBoard, seatName } from '../../room/RoomTable'
import { Board } from './Board'
import { lastLine, myColour, statusLine, type SnakesState } from './rules'
import styles from './Snakes.module.css'

const GAME_ID = 'snakes-and-ladders'
const TITLE = 'Snakes and ladders'

export default function SnakesAndLadders({ roomId }: GameEngineProps) {
  if (!roomId) {
    return (
      <Lobby gameId={GAME_ID} title={TITLE} lede="Race a friend to square 100. You need the exact number to finish." />
    )
  }
  return (
    <RoomTable<SnakesState>
      gameId={GAME_ID}
      title={TITLE}
      code={roomId}
      scores={({ game, myId }) => (
        <ScoreBoard
          entries={[
            {
              label: `Red · ${seatName(game.seats.red, myId)}`,
              value: game.scores.red,
              active: game.turn === 'red' && !game.winner,
            },
            {
              label: `Blue · ${seatName(game.seats.blue, myId)}`,
              value: game.scores.blue,
              active: game.turn === 'blue' && !game.winner,
            },
          ]}
        />
      )}
    >
      {({ game, myId, send }) => {
        const mine = myColour(game, myId)
        const bothSeated = !!game.seats.red && !!game.seats.blue
        const canRoll = !!mine && mine === game.turn && !game.winner && bothSeated
        return (
          <>
            <p className={roomStyles.status} aria-live="polite">
              {statusLine(game, myId)}
            </p>
            <Board game={game} />
            <div className={styles.dice}>
              {game.last && (
                <span className={styles.roll} aria-hidden="true">
                  {game.last.roll}
                </span>
              )}
              <Button onClick={() => send({ type: 'move' })} disabled={!canRoll}>
                Roll the dice
              </Button>
            </div>
            <p className={styles.what} aria-live="polite">
              {lastLine(game, myId)}
            </p>
          </>
        )
      }}
    </RoomTable>
  )
}
