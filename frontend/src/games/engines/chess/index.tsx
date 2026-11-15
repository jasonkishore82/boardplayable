import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Button } from '../../../components/Button'
import Dock from '../../../components/Dock/Dock'
import { playerAvatarUrls } from '../../../lib/avatars'
import { initials } from '../../../lib/initials'
import type { GameEngineProps } from '../../registry'
import { Lobby } from '../../room/Lobby'
import roomStyles from '../../room/Room.module.css'
import { RoomTable, seatName, type TableContext } from '../../room/RoomTable'
import { BoardSlot } from '../../room/tableView'
import { Board } from './Board'
import styles from './Chess.module.css'
import { PromotionPicker } from './Promotion'
import { glyph, isPromotion, lostPieces, myColor, pieceName, statusLine, type ChessState, type Color } from './rules'

const GAME_ID = 'chess'
const TITLE = 'Chess'

// State the side panel's dock uses: the resign confirmation and the copied-link message.
function useControls() {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  return { confirming, setConfirming, copied, setCopied }
}
type Controls = ReturnType<typeof useControls>

export default function Chess({ roomId, bot, seat }: GameEngineProps) {
  const controls = useControls()

  // The chess pages sit on a night-city picture, so they always use the dark colours, in light mode too.
  const page = (content: ReactNode) => (
    <div className={styles.stage} data-theme="dark">
      <div className={styles.backdrop} aria-hidden="true" />
      {content}
    </div>
  )

  if (!roomId) {
    return page(
      <Lobby
        gameId={GAME_ID}
        title={TITLE}
        lede="Play a friend online or take on a bot."
        bots
      />,
    )
  }
  return page(
    <RoomTable<ChessState>
      wide
      gameId={GAME_ID}
      title={TITLE}
      code={roomId}
      bot={bot}
      seat={seat}
      sideTitle={null}
      scores={(context) => <SidePanel {...context} />}
    >
      {(context) => <Play {...context} controls={controls} />}
    </RoomTable>,
  )
}

/** The board with the two players' names above and below it. */
function Play({ game, myId, send, controls }: TableContext<ChessState> & { controls: Controls }) {
  const mine = myColor(game, myId)
  const [selected, setSelected] = useState<string | null>(null)
  // A pawn move to the far end that is waiting for the player to choose what the pawn becomes.
  const [promoting, setPromoting] = useState<{ from: string; to: string } | null>(null)

  const bothSeated = !!game.seats.white && !!game.seats.black
  const myTurn = !!mine && mine === game.turn && !game.winner && bothSeated
  const targets = myTurn && selected ? (game.legal[selected] ?? []) : []
  const flipped = mine === 'black' // you always play from the bottom
  // You can change sides until the first move of a round. After that the choice is locked.
  const sidesLocked = (game.history ?? []).length > 0 || !!game.winner
  // The board is blurred under a "Start game" button until a player presses it.
  const waiting = game.live === false

  function pick(square: string) {
    if (targets.includes(square) && selected) {
      // A pawn reaching the far end asks what it should become before the move is sent.
      if (isPromotion(game.board, selected, square)) setPromoting({ from: selected, to: square })
      else send({ type: 'move', from: selected, to: square })
      setSelected(null)
    } else if (game.legal[square] && square !== selected) {
      setSelected(square)
    } else {
      setSelected(null)
    }
  }

  return (
    <div className={styles.area}>
      {promoting && myTurn && mine && (
        <PromotionPicker
          color={mine}
          onPick={(promotion) => {
            send({ type: 'move', ...promoting, promotion })
            setPromoting(null)
          }}
          onCancel={() => setPromoting(null)}
        />
      )}
      <PlayerStrip color={flipped ? 'white' : 'black'} game={game} myId={myId} />
      <div className={styles.boardWrap} data-waiting={waiting ? '' : undefined}>
        <BoardSlot>
          <Board
            game={game}
            flipped={flipped}
            selected={myTurn && !waiting ? selected : null}
            targets={waiting ? [] : targets}
            enabled={(square) => !waiting && myTurn && (!!game.legal[square] || targets.includes(square))}
            onSquare={pick}
          />
        </BoardSlot>
        {waiting && (
          <StartOverlay
            game={game}
            side={mine}
            onPick={(seat) => send({ type: 'seat', seat })}
            onStart={() => send({ type: 'start' })}
          />
        )}
      </div>
      <PlayerStrip color={flipped ? 'black' : 'white'} game={game} myId={myId}>
        {mine && <SidePicker side={mine} locked={sidesLocked} onPick={(seat) => send({ type: 'seat', seat })} />}
      </PlayerStrip>
      <div className={styles.dockSide} data-export-skip="">
        <ChessDock game={game} myId={myId} send={send} controls={controls} />
      </div>
    </div>
  )
}

/** Beside the board: what is going on when there is something to say, and the moves so far. */
function SidePanel({ game, myId }: TableContext<ChessState>) {
  // During play the name strips show whose move it is. The status line is for waiting and for the result.
  const playing = !!game.seats.white && !!game.seats.black && !game.winner

  return (
    <>
      {!playing && (
        <p className={roomStyles.status} aria-live="polite">
          {statusLine(game, myId)}
        </p>
      )}
      <MoveList moves={game.history ?? []} />
    </>
  )
}

/** True on a window wide enough to put the dock beside the board. */
function useBesideBoard() {
  const query = '(min-width: 1100px)'
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** The dock of actions: copy the game link and resign. Beside the board on wide windows, under it on narrow ones. */
function ChessDock({
  game,
  myId,
  send,
  controls,
}: Pick<TableContext<ChessState>, 'game' | 'myId' | 'send'> & { controls: Controls }) {
  const { confirming, setConfirming, copied, setCopied } = controls
  const beside = useBesideBoard()
  const mine = myColor(game, myId)
  const canResign = !!mine && !!game.seats.white && !!game.seats.black && !game.winner

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this game link', window.location.href)
    }
  }

  const items = [
    { icon: icons.link, label: copied ? 'Link copied' : 'Copy game link', onClick: copyLink },
    ...(canResign
      ? [
          { separator: true },
          ...(confirming
            ? [
                {
                  icon: icons.check,
                  label: 'Yes, resign',
                  onClick: () => {
                    send({ type: 'resign' })
                    setConfirming(false)
                  },
                },
                { icon: icons.close, label: 'Keep playing', onClick: () => setConfirming(false) },
              ]
            : [{ icon: icons.flag, label: 'Resign', onClick: () => setConfirming(true) }]),
        ]
      : []),
  ]

  return (
    <Dock
      items={items}
      position={beside ? 'left' : 'bottom'}
      theme="dark"
      accentColor="var(--accent)"
      baseItemSize={52}
      magnification={68}
      panelHeight={66}
    />
  )
}

/** The moves so far, two to a line: "1. e4 e5". The latest move is highlighted, and the list follows it. */
function MoveList({ moves }: { moves: string[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  const rows = Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => [moves[i * 2], moves[i * 2 + 1]])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [moves.length])

  return (
    <section className={styles.movesCard}>
      <h2 className={styles.movesHead}>Moves</h2>
      <ol className={styles.moves} ref={listRef} aria-label="Moves so far" data-export-skip="">
        {rows.length === 0 && <li className={styles.noMoves}>No moves yet.</li>}
        {rows.map(([white, black], i) => (
          <li key={i}>
            <span className={styles.moveNumber}>{i + 1}.</span>
            <span className={i * 2 === moves.length - 1 ? styles.lastMove : undefined}>{white}</span>
            <span className={i * 2 + 1 === moves.length - 1 ? styles.lastMove : undefined}>{black}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Over the blurred board before a game begins: the "Start game" button, or what it is waiting for. */
function StartOverlay({
  game,
  side,
  onPick,
  onStart,
}: {
  game: ChessState
  side: Color | null
  onPick: (side: Color) => void
  onStart: () => void
}) {
  const ready = !!game.seats.white && !!game.seats.black
  return (
    <div className={styles.startOverlay} data-export-skip="">
      <div className={styles.startCard}>
        {!side ? (
          <p className={styles.startNote}>Waiting for the players to start.</p>
        ) : ready ? (
          <>
            <p className={styles.startNote}>Pick your side, then start.</p>
            <SidePicker side={side} locked={false} onPick={onPick} />
            <Button onClick={onStart}>Start game</Button>
          </>
        ) : (
          <p className={styles.startNote}>Waiting for an opponent to join. Share the room code or the invite link.</p>
        )}
      </div>
    </div>
  )
}

/** White or Black, at the right end of your own name strip. Locked (shown, but not pressable) once a move is played. */
function SidePicker({ side, locked, onPick }: { side: Color; locked: boolean; onPick: (side: Color) => void }) {
  return (
    <span
      className={styles.sides}
      role="group"
      aria-label={locked ? 'Play as (locked while the game is in play)' : 'Play as'}
      title={locked ? 'Sides are locked once the game is in play' : undefined}
      data-locked={locked ? '' : undefined}
      data-export-skip=""
    >
      {locked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      )}
      {(['white', 'black'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={styles.side}
          aria-pressed={side === option}
          disabled={locked}
          onClick={() => side !== option && onPick(option)}
        >
          {option === 'white' ? 'White' : 'Black'}
        </button>
      ))}
    </span>
  )
}

type PlayerStripProps = {
  color: Color
  game: ChessState
  myId: string | undefined
  /** Shown at the right end of the strip. */
  children?: ReactNode
}

/** The name of whoever plays this colour, above or below the board, with the pieces they have taken beside it. */
function PlayerStrip({ color, game, myId, children }: PlayerStripProps) {
  const turn = game.turn === color && !game.winner
  // What this player has taken is what the other side has lost.
  const taken = lostPieces(game.board, color === 'white' ? 'black' : 'white')
  const seat = game.seats[color]
  const portrait = playerAvatarUrls(seat?.id)
  return (
    <div className={[styles.player, turn && styles.turn].filter(Boolean).join(' ')}>
      {/* A computer opponent shows its portrait. A person shows their initials on their side's colour. */}
      {portrait ? (
        <Avatar name={seat?.username ?? 'Bot'} src={portrait} size={36} className={styles.portrait} />
      ) : (
        <span
          className={[styles.avatar, color === 'white' ? styles.avatarWhite : styles.avatarBlack].join(' ')}
          aria-hidden="true"
        >
          {initials(seat?.username ?? '?')}
        </span>
      )}
      <span className={styles.name}>{seatName(game.seats[color], myId)}</span>
      {taken.length > 0 && (
        <span className={styles.taken} role="img" aria-label={`Taken: ${taken.map(pieceName).join(', ')}`}>
          {taken.map((piece, i) => (
            <span
              key={i}
              className={[
                color === 'white' ? styles.black : styles.white, // the taken pieces are the other side's colour
                piece === taken[i - 1] && styles.takenSame,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            >
              {glyph(piece)}
            </span>
          ))}
        </span>
      )}
      {children}
    </div>
  )
}

const iconProps = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const icons = {
  link: (
    <svg {...iconProps}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
    </svg>
  ),
  flag: (
    <svg {...iconProps}>
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </svg>
  ),
  check: (
    <svg {...iconProps}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  ),
  close: (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
}
