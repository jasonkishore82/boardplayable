import {
  Component,
  createContext,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Button } from '../../components/Button'
import { ChatView, type ChatLine } from '../../components/chat/ChatView'
import Dock from '../../components/Dock/Dock'
import { scenes } from '../../three/scenes'
import styles from './Room.module.css'

/** How the board is shown: flat, in 3D (turn it with the mouse), or cinematic (the camera moves on its own). */
export type ViewMode = 'standard' | '3d' | 'cinematic'

export type TableView = {
  gameId: string
  view: ViewMode
  setView: (view: ViewMode) => void
  game: unknown
  myId: string | undefined
  send: (message: Record<string, unknown>) => void
  /** The room's chat, so it can be used from the full-screen board. */
  chat: ChatLine[]
  onChat: (text: string) => void
  chatDisabled: boolean
  /** The end-of-game card, to show inside the board when it is full screen. Null when there is none. */
  resultCard?: ReactNode
}

export const TableViewContext = createContext<TableView | null>(null)

// Cinematic is switched off for now: it has no tab, and a saved choice of it falls back to the standard board.
const VIEWS: ViewMode[] = ['standard', '3d']

export function isViewMode(value: unknown): value is ViewMode {
  return typeof value === 'string' && (VIEWS as string[]).includes(value)
}

const VIEW_KEY = 'boardplayable.view'

/** The board view saved from the lobby or the table. Falls back to the standard board. */
export function readSavedView(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    return isViewMode(saved) ? saved : 'standard'
  } catch {
    return 'standard'
  }
}

export function saveView(view: ViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    // Storage can be blocked; the view still changes for this visit.
  }
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** A line like "White · Nf3" or "X · square 5" describing the latest move, for the cinematic caption. */
export function lastMoveCaption(gameId: string, game: unknown): string | null {
  const history = (game as { history?: string[] } | null)?.history
  const last = history?.at(-1)
  if (!history || !last) return null
  if (gameId === 'chess') return `${history.length % 2 === 1 ? 'White' : 'Black'} · ${last}`
  if (gameId === 'tic-tac-toe') return `${last.slice(0, 1)} · square ${last.slice(1)}`
  return last
}

class SceneBoundary extends Component<{ onBack: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('3D board failed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={styles.stageNote} role="alert">
        <p>The 3D board couldn’t start on this device.</p>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to the standard board
        </Button>
      </div>
    )
  }
}

/**
 * Where a game's flat board goes. In the standard view it shows the children as they are. In 3D or cinematic view
 * it shows the game's 3D scene in its place, so the status line and buttons around it stay put.
 */
export function BoardSlot({ children }: { children: ReactNode }) {
  const table = useContext(TableViewContext)
  const Scene = table ? scenes[table.gameId] : undefined
  const stage = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [seenOthers, setSeenOthers] = useState(0)
  const othersCount = table ? table.chat.filter((line) => !line.mine).length : 0

  // Opening the chat marks what is in it as read. Leaving full screen closes it.
  useEffect(() => {
    if (chatOpen) setSeenOthers(othersCount)
  }, [chatOpen, othersCount])
  useEffect(() => {
    if (!fullscreen) setChatOpen(false)
  }, [fullscreen])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Marked so "Export screenshot" can take a picture of the board alone.
  if (!table || !Scene || table.view === 'standard') {
    return (
      <div className={styles.boardCapture} data-export-board="">
        {children}
      </div>
    )
  }

  const { view, setView, gameId, game, myId, send, chat, onChat, chatDisabled, resultCard } = table
  const unread = chatOpen ? 0 : Math.max(0, othersCount - seenOthers)
  const caption = view === 'cinematic' ? lastMoveCaption(gameId, game) : null

  return (
    <div className={styles.stage} data-view={view} data-export-board="" ref={stage}>
      {webglAvailable() ? (
        <SceneBoundary onBack={() => setView('standard')}>
          <Suspense fallback={<p className={styles.stageNote}>Loading the 3D board…</p>}>
            <Scene game={game} myId={myId} send={send} mode={view} />
          </Suspense>
        </SceneBoundary>
      ) : (
        <div className={styles.stageNote} role="alert">
          <p>This browser can’t show 3D.</p>
          <Button variant="secondary" onClick={() => setView('standard')}>
            Back to the standard board
          </Button>
        </div>
      )}

      {view === 'cinematic' && (
        <>
          <div className={styles.letterboxTop} aria-hidden="true" />
          <div className={styles.letterboxBottom} aria-hidden="true" />
          <div className={styles.vignette} aria-hidden="true" />
          {caption && <p className={styles.caption}>{caption}</p>}
        </>
      )}
      {view === '3d' && (
        <p className={styles.stageHint} data-export-skip="">
          Drag to turn · scroll to zoom
        </p>
      )}
      <div className={styles.stageDock} data-export-skip="">
        <Dock
          items={[
            {
              icon: fullscreen ? stageIcons.shrink : stageIcons.expand,
              label: fullscreen ? 'Exit full screen' : 'Full screen',
              onClick: () => (fullscreen ? document.exitFullscreen() : stage.current?.requestFullscreen()),
            },
            ...(fullscreen
              ? [
                  {
                    icon: stageIcons.chat,
                    label: unread ? `Chat, ${unread} new` : 'Chat',
                    badge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
                    active: chatOpen,
                    onClick: () => setChatOpen((open) => !open),
                  },
                ]
              : []),
          ]}
          theme="dark"
          accentColor="#7433d6"
          baseItemSize={44}
          magnification={60}
          panelHeight={58}
        />
      </div>
      {fullscreen && resultCard}
      {fullscreen && chatOpen && (
        <aside className={styles.stageChat} aria-label="Game chat" data-export-skip="">
          <div className={styles.stageChatHead}>
            <span>Chat</span>
            <button
              type="button"
              className={styles.stageChatClose}
              aria-label="Close chat"
              onClick={() => setChatOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className={styles.stageChatBody}>
            <ChatView
              label="Game chat"
              lines={chat}
              maxLength={500}
              placeholder="Say something"
              emptyText="No messages yet."
              disabled={chatDisabled}
              onSend={onChat}
            />
          </div>
        </aside>
      )}
    </div>
  )
}

const stageIconProps = {
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

const stageIcons = {
  expand: (
    <svg {...stageIconProps}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  ),
  shrink: (
    <svg {...stageIconProps}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  ),
  chat: (
    <svg {...stageIconProps}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z" />
    </svg>
  ),
}
