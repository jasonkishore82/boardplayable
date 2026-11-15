import type { GameEngineProps } from '../../registry'
import { Lobby } from '../../room/Lobby'
import { RoomTable, ScoreBoard, seatName } from '../../room/RoomTable'
import { BoardSlot } from '../../room/tableView'
import roomStyles from '../../room/Room.module.css'
import { Board } from './Board'
import { canPlay, statusLine, type TttState } from './rules'

const GAME_ID = 'tic-tac-toe'
const TITLE = 'Tic-tac-toe'

export default function TicTacToe({ roomId, bot }: GameEngineProps) {
  if (!roomId) {
    return <Lobby gameId={GAME_ID} title={TITLE} lede="Play a friend online or take on a bot." bots />
  }
  return (
    <RoomTable<TttState>
      gameId={GAME_ID}
      title={TITLE}
      code={roomId}
      bot={bot}
      scores={({ game, myId }) => (
        <ScoreBoard
          entries={[
            {
              label: `X · ${seatName(game.seats.X, myId)}`,
              value: game.scores.X,
              active: game.turn === 'X' && !game.winner,
            },
            { label: 'Draws', value: game.scores.draw },
            {
              label: `O · ${seatName(game.seats.O, myId)}`,
              value: game.scores.O,
              active: game.turn === 'O' && !game.winner,
            },
          ]}
        />
      )}
    >
      {({ game, myId, send }) => (
        <>
          <p className={roomStyles.status} aria-live="polite">
            {statusLine(game, myId)}
          </p>
          <BoardSlot>
            <Board
              board={game.board}
              line={game.line}
              disabled={(cell) => !canPlay(game, myId, cell)}
              onPlay={(cell) => send({ type: 'move', cell })}
            />
          </BoardSlot>
        </>
      )}
    </RoomTable>
  )
}
