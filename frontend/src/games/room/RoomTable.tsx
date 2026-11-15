import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { ChatView, type ChatLine } from '../../components/chat/ChatView'
import { playerAvatarUrls } from '../../lib/avatars'
import { hasScene } from '../../three/scenes'
import { recordGame } from '../../lib/gameHistory'
import {
  boardElement,
  captureElement,
  downloadDataUrl,
  exportName,
  exportPdf,
  historyTable,
  type Captured,
  type PdfRound,
} from './export'
import { BackArrow } from './BackArrow'
import { describeResult } from './result'
import { ResultCard } from './ResultCard'
import { TableViewContext, readSavedView, saveView, type ViewMode } from './tableView'
import { useRoom } from './useRoom'
import styles from './Room.module.css'

export type Seat = { id: string; username: string | null } | null

/** What every game's state has in common. The rest is up to the game. */
export type RoomGame = {
  seats: Record<string, Seat>
  winner: string | null
  /** The moves played this round, oldest first. Used for the PDF export. */
  history?: string[]
}

export type TableContext<State> = {
  game: State
  myId: string | undefined
  /** True when this player holds a seat (as opposed to watching). */
  seated: boolean
  /** Sends a message to the room. Problems are shown under the board. */
  send: (message: Record<string, unknown>) => void
}

type Props<State extends RoomGame> = {
  gameId: string
  title: string
  code: string
  /** Computer opponent to play ("easy", "medium", "jkw"). Only takes effect when this player opens the room. */
  bot?: string
  /** The side the player asked for in the lobby. Only used when they are given a seat. */
  seat?: string
  /** Give the board more room (chess). */
  wide?: boolean
  /** Heading of the side panel. */
  sideTitle?: string | null
  /** The scores, shown in the side panel next to the board. */
  scores?: (context: TableContext<State>) => ReactNode
  /** Renders the board and anything that belongs above it. */
  children: (context: TableContext<State>) => ReactNode
}

// The frame every game shares: invite link, connection handling, rematch button and chat.
export function RoomTable<State extends RoomGame>({
  gameId,
  title,
  code,
  bot,
  seat,
  wide,
  sideTitle = 'Scores',
  scores,
  children,
}: Props<State>) {
  const { user } = useAuth()
  const { status, players, game, chat, notice, failure, send } = useRoom<State>(`${gameId}:${code}`, { bot, seat })
  const [copied, setCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [moveError, setMoveError] = useState('')
  const has3d = hasScene(gameId)
  const [savedView, setSavedView] = useState<ViewMode>(readSavedView)
  const view: ViewMode = has3d ? savedView : 'standard'
  const playRef = useRef<HTMLElement>(null)
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState('')
  // The chat starts open. Hidden, it becomes a "Chat" button in the corner with a count of unread messages.
  const [chatOpen, setChatOpen] = useState(true)
  const [seenCount, setSeenCount] = useState(0)
  const [resultOpen, setResultOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const lastWinner = useRef<string | null | undefined>(undefined)
  // Every game finished in this room while it was open (rematches make more than one). The PDF holds all of them.
  const [finished, setFinished] = useState<PdfRound[]>([])
  const recordedCurrent = useRef(false)
  const gameRef = useRef(game)
  gameRef.current = game

  // The result card pops up when a game ends while you are in it. It does not pop up when you open a game that
  // had already ended, and it goes away when a rematch starts.
  const winner = game ? game.winner : undefined
  useEffect(() => {
    if (winner === undefined) return // no game state yet
    if (lastWinner.current === undefined) {
      lastWinner.current = winner
      return
    }
    if (!lastWinner.current && winner) {
      setResultOpen(true)
      // Keep this game for the PDF: its final position now, before a rematch clears the board.
      const ended = gameRef.current
      if (ended) {
        recordedCurrent.current = true
        // And in the player's game history (Profile), if they played in it.
        const mySeat = user ? Object.entries(ended.seats).find(([, who]) => who?.id === user.id)?.[0] : undefined
        if (user && mySeat) {
          const other = Object.entries(ended.seats).find(([seat]) => seat !== mySeat)?.[1]
          recordGame(user.id, {
            id: `${gameId}:${code}:${Date.now()}`,
            gameId,
            title,
            opponent: other?.username ?? 'Opponent',
            result: winner === 'draw' ? 'draw' : winner === mySeat ? 'won' : 'lost',
            at: Date.now(),
            moves: ended.history?.length ?? 0,
          })
        }
        window.setTimeout(async () => {
          let image: Captured | null = null
          try {
            if (playRef.current) image = await captureElement(boardElement(playRef.current), 'JPEG')
          } catch {
            // The PDF still lists the game's moves without a picture.
          }
          setFinished((list) => [...list, roundOf(ended, image, list.length + 1)])
        }, 400)
      }
    }
    if (!winner) {
      setResultOpen(false)
      recordedCurrent.current = false
    }
    lastWinner.current = winner
    // roundOf only reads its arguments and the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner])

  // In full screen only the board is on screen, so the card is drawn inside it there.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function setView(next: ViewMode) {
    setSavedView(next)
    saveView(next)
  }

  const seats = game ? Object.values(game.seats) : []
  const seated = seats.some((seat) => seat && seat.id === user?.id)
  // People in the room who hold no seat. A computer opponent holds a seat but is not in the room.
  const seatIds = new Set(seats.map((seat) => seat?.id))
  const watching = players.filter((p) => !seatIds.has(p.id)).length

  const result = game ? describeResult(gameId, game as RoomGame & { reason?: string | null }, user?.id) : null
  const resultCard = (contained: boolean) =>
    result && resultOpen ? (
      <ResultCard
        result={result}
        contained={contained}
        onClose={() => setResultOpen(false)}
        onRematch={
          seated
            ? () => {
                setResultOpen(false)
                safeSend({ type: 'rematch' })
              }
            : undefined
        }
        onExport={exportAsPdf}
        exporting={exporting === 'pdf'}
      />
    ) : null

  const lines: ChatLine[] = chat.map((m) => ({
    id: m.id,
    mine: m.from === user?.id,
    author: m.username ?? 'Player',
    body: m.text,
    at: m.at,
    avatar: playerAvatarUrls(m.from),
    system: m.system,
  }))

  const unread = chatOpen ? 0 : Math.max(0, chat.length - seenCount)

  function showChat(open: boolean) {
    setChatOpen(open)
    setSeenCount(chat.length)
  }

  function safeSend(message: Record<string, unknown>) {
    try {
      send(message)
      setMoveError('')
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : 'Couldn’t play that move.')
    }
  }

  // A picture of just the board as it is on screen, in whichever view is showing.
  async function exportScreenshot() {
    if (!playRef.current) return
    setExporting('png')
    setExportError('')
    try {
      const shot = await captureElement(boardElement(playRef.current))
      downloadDataUrl(exportName(gameId, 'png'), shot.dataUrl)
    } catch {
      setExportError('Couldn’t save the screenshot. Try again.')
    } finally {
      setExporting(null)
    }
  }

  // One game of the PDF: the players, the result, the position and every move.
  function roundOf(g: NonNullable<typeof game>, image: Captured | null, number: number): PdfRound {
    const won = g.winner
    const result = !won
      ? 'Game in progress'
      : won === 'draw'
        ? 'Result: draw'
        : `Result: ${g.seats[won]?.username ?? won} won`
    const names = Object.entries(g.seats).map(([seat, who]) => `${seat}: ${who?.username ?? 'empty seat'}`)
    const scores = (g as unknown as { scores?: Record<string, number> }).scores
    return {
      title: won ? `${title} - final position` : `${title} - position`,
      subtitle: `Game ${number}  ·  Room ${code}  ·  ${new Date().toLocaleString()}`,
      lines: [
        result,
        `Players: ${names.join('   ·   ')}`,
        ...(scores
          ? [
              `Scores: ${Object.entries(scores)
                .map(([key, value]) => `${key} ${value}`)
                .join('   ·   ')}`,
            ]
          : []),
      ],
      image,
      history: historyTable(gameId, g.history),
    }
  }

  // A PDF with every game played in this room: the games already finished, then the one on the board.
  async function exportAsPdf() {
    if (!playRef.current || !game) return
    setExporting('pdf')
    setExportError('')
    try {
      const rounds = [...finished]
      // The game on the board counts unless it is a finished one that is already in the list.
      if (!(game.winner && recordedCurrent.current)) {
        const image = await captureElement(boardElement(playRef.current), 'JPEG')
        rounds.push(roundOf(game, image, rounds.length + 1))
      }
      const total = rounds.length
      await exportPdf({
        rounds: rounds.map((round, i) => ({
          ...round,
          subtitle: round.subtitle.replace(/^Game \d+/, `Game ${i + 1} of ${total}`),
        })),
        filename: exportName(gameId, 'pdf'),
      })
    } catch {
      setExportError('Couldn’t make the PDF. Try again.')
    } finally {
      setExporting(null)
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/games/${gameId}?room=${code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this invite link', link)
    }
  }

  // Copies just the room code, for reading out or typing into "Have a code?" in the lobby.
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      window.prompt('Copy this room code', code)
    }
  }

  if (status === 'failed') {
    return (
      <div className={styles.lobby}>
        <Link to={`/games/${gameId}`} className={styles.back}>
          <BackArrow /> {title}
        </Link>
        <h1>Can’t join this game</h1>
        <p className={styles.lede} role="alert">
          {failure}
        </p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    )
  }

  return (
    <div className={styles.table} data-wide={wide ? '' : undefined}>
      {!isFullscreen && resultCard(false)}
      <div className={styles.top}>
        <Link to={`/games/${gameId}`} className={styles.back}>
          <BackArrow /> Leave game
        </Link>
        {/* The room code is always on show. Press it to copy it. */}
        <div className={styles.invite} data-export-skip="">
          <button
            type="button"
            className={styles.code}
            onClick={copyCode}
            aria-label={`Room code ${code.split('').join(' ')}. Press to copy.`}
            title="Copy room code"
          >
            <span className={styles.codeLabel}>{codeCopied ? 'Copied' : 'Room code'}</span>
            <span className={styles.codeValue}>{code}</span>
          </button>
          {!bot && (
            <Button variant="secondary" onClick={copyInvite}>
              {copied ? 'Link copied' : 'Copy invite link'}
            </Button>
          )}
        </div>
        {game && (
          <div className={styles.exports} data-export-skip="">
            <button
              type="button"
              className={styles.exportButton}
              aria-label="Export screenshot"
              title="Export screenshot"
              disabled={exporting !== null}
              data-busy={exporting === 'png' ? '' : undefined}
              onClick={exportScreenshot}
            >
              <svg {...exportIconProps}>
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.exportButton}
              aria-label="Export PDF"
              title="Export PDF"
              disabled={exporting !== null}
              data-busy={exporting === 'pdf' ? '' : undefined}
              onClick={exportAsPdf}
            >
              <svg {...exportIconProps}>
                <path d="M7 3h7l4 4v14H7z" />
                <path d="M14 3v4h4M9.5 13h5M9.5 16.5h5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className={styles.cols} data-chat={chatOpen ? 'open' : 'closed'} data-side={wide ? 'right' : undefined}>
        {game && scores && (
          <aside className={styles.side} aria-label={sideTitle ?? 'Side panel'}>
            {sideTitle && <h2 className={[styles.chatTitle, styles.sideTitle].join(' ')}>{sideTitle}</h2>}
            {scores({ game, myId: user?.id, seated, send: safeSend })}
          </aside>
        )}

        <section
          className={styles.play}
          aria-label="Game"
          ref={playRef}
          data-view={view}
          data-wide={wide ? '' : undefined}
        >
          {!game ? (
            <p className={styles.status} aria-live="polite">
              {status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
            </p>
          ) : (
            <>
              <TableViewContext.Provider
                value={{
                  gameId,
                  view,
                  setView,
                  game,
                  myId: user?.id,
                  send: safeSend,
                  chat: lines,
                  onChat: (text) => safeSend({ type: 'chat', text }),
                  chatDisabled: status !== 'open',
                  resultCard: resultCard(true),
                }}
              >
                {children({ game, myId: user?.id, seated, send: safeSend })}
              </TableViewContext.Provider>
              <div className={styles.under} aria-live="polite" data-export-skip="">
                {moveError || notice || exportError ? (
                  <p className={styles.problem}>{moveError || notice || exportError}</p>
                ) : null}
                {game.winner && seated && <Button onClick={() => safeSend({ type: 'rematch' })}>Play again</Button>}
                {!seated && <p className={styles.muted}>You’re watching this game.</p>}
                {watching > 0 && seated && <p className={styles.muted}>{watching} watching</p>}
              </div>
            </>
          )}
        </section>

        {chatOpen ? (
          <section className={styles.chatBox} aria-label="Game chat">
            <div className={styles.chatHead}>
              <div className={styles.chatHeadText}>
                <h2 className={styles.chatHeadTitle}>Chat</h2>
                <p className={styles.chatHeadSub}>
                  <span className={styles.onlineDot} aria-hidden="true" />
                  {players.length} in the room
                </p>
              </div>
              <button
                type="button"
                className={styles.chatCollapse}
                onClick={() => showChat(false)}
                aria-label="Hide chat"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className={styles.chatBody}>
              <ChatView
                label="Game chat"
                lines={lines}
                maxLength={500}
                placeholder="Say something"
                emptyText="No messages yet."
                disabled={status !== 'open'}
                note={status === 'reconnecting' ? 'Reconnecting…' : ''}
                onSend={(text) => safeSend({ type: 'chat', text })}
              />
            </div>
          </section>
        ) : (
          <button type="button" className={styles.chatFab} onClick={() => showChat(true)}>
            Chat
            {unread > 0 && (
              <span className={styles.chatBadge} aria-label={`${unread} new`}>
                {unread}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export type ScoreEntry = { label: string; value: number; active?: boolean }

/** A row of score tiles. The tile for whoever's turn it is gets highlighted. */
export function ScoreBoard({ entries }: { entries: ScoreEntry[] }) {
  return (
    <dl className={styles.scores}>
      {entries.map((entry) => (
        <div key={entry.label} className={entry.active ? styles.activeScore : undefined}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "Ada (you)", "Bo", or "Waiting…" for a seat. */
export function seatName(seat: Seat, myId: string | undefined): string {
  if (!seat) return 'Waiting…'
  const name = seat.username ?? 'Player'
  return seat.id === myId ? `${name} (you)` : name
}

const exportIconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const
