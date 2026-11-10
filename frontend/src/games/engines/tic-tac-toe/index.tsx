import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Button } from '../../../components/Button'
import { ChatView, type ChatLine } from '../../../components/chat/ChatView'
import { TextField } from '../../../components/TextField'
import type { GameEngineProps } from '../../registry'
import { useRoom } from '../../room/useRoom'
import { Board } from './Board'
import { canPlay, myMark, newRoomCode, parseRoomCode, statusLine, type TttState } from './rules'
import styles from './TicTacToe.module.css'

const GAME_ID = 'tic-tac-toe'

// /games/tic-tac-toe is the lobby. /games/tic-tac-toe?room=<code> is a table.
export default function TicTacToe({ roomId }: GameEngineProps) {
  return roomId ? <Table code={roomId} /> : <Lobby />
}

function Lobby() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function join(event: FormEvent) {
    event.preventDefault()
    const parsed = parseRoomCode(code)
    if (!parsed) {
      setError('That doesn’t look like a game code. Paste the code or the whole invite link.')
      return
    }
    navigate(`/games/${GAME_ID}?room=${parsed}`)
  }

  return (
    <div className={styles.lobby}>
      <Link to="/games" className={styles.back}>
        <span aria-hidden="true">←</span> Games
      </Link>
      <h1>Tic-tac-toe</h1>
      <p className={styles.lede}>Play a friend online. Start a game, send them the link, and chat while you play.</p>

      <Button onClick={() => navigate(`/games/${GAME_ID}?room=${newRoomCode()}`)}>Start a game</Button>

      <form className={styles.join} onSubmit={join} noValidate>
        <TextField
          label="Have a code?"
          placeholder="Game code or invite link"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError('')
          }}
          error={error || undefined}
        />
        <Button type="submit" variant="secondary" disabled={!code.trim()}>
          Join game
        </Button>
      </form>
    </div>
  )
}

function Table({ code }: { code: string }) {
  const { user } = useAuth()
  const { status, players, game, chat, notice, failure, send } = useRoom<TttState>(`${GAME_ID}:${code}`)
  const [copied, setCopied] = useState(false)
  const [moveError, setMoveError] = useState('')

  const mine = game ? myMark(game, user?.id) : null
  const gameOver = !!game?.winner

  const lines: ChatLine[] = chat.map((m) => ({
    id: m.id,
    mine: m.from === user?.id,
    author: m.username ?? 'Player',
    body: m.text,
    at: m.at,
  }))

  function play(cell: number) {
    try {
      send({ type: 'move', cell })
      setMoveError('')
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : 'Couldn’t play that move.')
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/games/${GAME_ID}?room=${code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this invite link', link)
    }
  }

  if (status === 'failed') {
    return (
      <div className={styles.lobby}>
        <Link to={`/games/${GAME_ID}`} className={styles.back}>
          <span aria-hidden="true">←</span> Tic-tac-toe
        </Link>
        <h1>Can’t join this game</h1>
        <p className={styles.lede} role="alert">
          {failure}
        </p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    )
  }

  const watching = players.length - (game?.seats.X ? 1 : 0) - (game?.seats.O ? 1 : 0)

  return (
    <div className={styles.table}>
      <div className={styles.top}>
        <Link to={`/games/${GAME_ID}`} className={styles.back}>
          <span aria-hidden="true">←</span> Leave game
        </Link>
        <div className={styles.invite}>
          <span className={styles.code}>Game {code}</span>
          <Button variant="secondary" onClick={copyInvite}>
            {copied ? 'Link copied' : 'Copy invite link'}
          </Button>
        </div>
      </div>

      <div className={styles.cols}>
        <section className={styles.play} aria-label="Game">
          {!game ? (
            <p className={styles.status} aria-live="polite">
              {status === 'reconnecting' ? 'Reconnecting…' : 'Setting up the table…'}
            </p>
          ) : (
            <>
              <Scores game={game} myId={user?.id} />
              <p className={styles.status} aria-live="polite">
                {statusLine(game, user?.id)}
              </p>
              <Board
                board={game.board}
                line={game.line}
                disabled={(cell) => !canPlay(game, user?.id, cell)}
                onPlay={play}
              />
              <div className={styles.under} aria-live="polite">
                {moveError || notice ? <p className={styles.problem}>{moveError || notice}</p> : null}
                {gameOver && mine && (
                  <Button onClick={() => send({ type: 'rematch' })}>Play again</Button>
                )}
                {!mine && <p className={styles.muted}>You’re watching this game.</p>}
                {watching > 0 && mine && <p className={styles.muted}>{watching} watching</p>}
              </div>
            </>
          )}
        </section>

        <section className={styles.chatBox} aria-label="Game chat">
          <h2 className={styles.chatTitle}>Chat</h2>
          <div className={styles.chatBody}>
            <ChatView
              label="Game chat"
              lines={lines}
              maxLength={500}
              placeholder="Say something"
              emptyText="Say hi. Everyone at the table can read this."
              disabled={status !== 'open'}
              note={status === 'reconnecting' ? 'Reconnecting…' : ''}
              onSend={(text) => send({ type: 'chat', text })}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function Scores({ game, myId }: { game: TttState; myId: string | undefined }) {
  const label = (mark: 'X' | 'O') => {
    const seat = game.seats[mark]
    const name = seat?.username ?? (seat ? 'Player' : 'Waiting…')
    return seat && seat.id === myId ? `${name} (you)` : name
  }
  return (
    <dl className={styles.scores}>
      <div className={game.turn === 'X' && !game.winner ? styles.activeScore : undefined}>
        <dt>X · {label('X')}</dt>
        <dd>{game.scores.X}</dd>
      </div>
      <div>
        <dt>Draws</dt>
        <dd>{game.scores.draw}</dd>
      </div>
      <div className={game.turn === 'O' && !game.winner ? styles.activeScore : undefined}>
        <dt>O · {label('O')}</dt>
        <dd>{game.scores.O}</dd>
      </div>
    </dl>
  )
}
