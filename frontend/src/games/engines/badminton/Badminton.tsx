import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { PhonePanel } from '../../controller/PhonePanel'
import { createSwing } from '../../controller/swing'
import { usePhoneController, type ControllerHandlers } from '../../controller/usePhoneController'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import Arena from './Arena'
import { createMatch, swing, type Match, type MatchEvent } from './game/match'
import { DIFFICULTY, strengthOf, type Difficulty } from './game/play'
import { serveCourt } from './game/rules'
import styles from './Badminton.module.css'

// Badminton: a game of singles against the computer on a full-size BWF court. Your player runs to the shuttle on
// their own; you choose when to swing and where it goes. Aim with the mouse (where on their court) and click to
// swing, or the arrow keys and Space; or hold your phone like the racket (the same phone controller as Free Fly: scan
// the QR code on the menu), tilt it to aim across the court and swing it back and through to hit. A soft swing
// drops it short, a hard one from up high smashes.

const CourtModel = lazy(() => import('./models/BadmintonCourtModel.jsx'))

type Phase = 'setup' | 'play' | 'over'
type Banner = { title: string; detail: string; tone: 'you' | 'cpu' | 'info'; n: number }

const SETUP_KEY = 'bp-badminton-setup'
const CALLS = { in: 'Point', out: 'Out', net: 'Net', fault: 'Service fault' } as const

function loadSetup(): { difficulty: Difficulty; to: 11 | 21 } {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY) ?? 'null')
    if (s && ['easy', 'medium', 'hard'].includes(s.difficulty) && (s.to === 11 || s.to === 21)) return s
  } catch {
    /* fall through */
  }
  return { difficulty: 'medium', to: 21 }
}

function useCoarsePointer() {
  const query = '(pointer: coarse)'
  const [coarse, setCoarse] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setCoarse(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return coarse
}

export default function Badminton(_: GameEngineProps) {
  const { user } = useAuth()
  const you = user?.username ?? 'You'
  const touch = useCoarsePointer()
  const [setup, setSetup] = useState(loadSetup)
  const [phase, setPhase] = useState<Phase>('setup')
  const [sound, setSound] = useState(true)
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [server, setServer] = useState<0 | 1>(0)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [winner, setWinner] = useState<0 | 1 | null>(null)
  const [rally, setRally] = useState(0)
  const [best, setBest] = useState(0)
  const [courtRoom, setCourtRoom] = useState(false)

  // the match the arena runs: a computer-v-computer exhibition behind the menu, yours once you start
  const match = useRef<Match | null>(createMatch({ to: 21, difficulty: 'medium', cpu: [true, true] }))
  const aimVisible = useRef(false)
  const live = useRef({ phase })
  live.current = { phase }
  const rallyRef = useRef(0)

  // ---- phone controller ----
  const phoneHandlers = useRef<ControllerHandlers>({})
  const ctrl = usePhoneController('badminton', phoneHandlers)
  const sendRef = useRef(ctrl.send)
  sendRef.current = ctrl.send
  const phoneSwing = useMemo(() => createSwing(), [])

  const start = useCallback(() => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(setup))
    } catch {
      /* storage unavailable */
    }
    match.current = createMatch({ to: setup.to, difficulty: setup.difficulty, cpu: [false, true], server: 0 })
    aimVisible.current = true
    setScore([0, 0])
    setServer(0)
    setWinner(null)
    setBanner(null)
    setRally(0)
    setBest(0)
    rallyRef.current = 0
    setPhase('play')
    sendRef.current({ type: 'calibrate' })
  }, [setup])

  const toSetup = useCallback(() => {
    match.current = createMatch({ to: 21, difficulty: 'medium', cpu: [true, true] })
    aimVisible.current = false
    setBanner(null)
    setPhase('setup')
  }, [])

  const doSwing = useCallback((strength = 0.6, smash = false) => {
    const m = match.current
    if (live.current.phase !== 'play' || !m) return
    swing(m, 0, strength, smash)
  }, [])

  const onEvents = useCallback((events: MatchEvent[]) => {
    if (live.current.phase !== 'play') return
    const m = match.current
    if (!m) return
    for (const e of events) {
      if (e.type === 'hit') {
        rallyRef.current += 1
        if (e.side === 0) sendRef.current({ type: 'haptic', pattern: e.kind === 'smash' ? 'double' : 'tap' })
      } else if (e.type === 'point') {
        const mine = e.winner === 0
        const call = CALLS[e.call]
        setBanner({
          title: mine ? 'Your point' : 'Their point',
          detail: e.call === 'in' ? (mine ? 'Winner!' : 'It landed in on your side.') : `${call}.`,
          tone: mine ? 'you' : 'cpu',
          n: Date.now(),
        })
        setScore([...m.score.points])
        setServer(m.score.server)
        setRally(rallyRef.current)
        setBest((b) => Math.max(b, rallyRef.current))
        rallyRef.current = 0
        sendRef.current({ type: 'haptic', pattern: mine ? 'triple' : 'long' })
      } else if (e.type === 'over') {
        setWinner(e.winner)
        setPhase('over')
        aimVisible.current = false
      }
    }
  }, [])

  phoneHandlers.current = {
    onTilt: (x, y) => {
      const m = match.current
      if (!m || live.current.phase !== 'play') return
      m.aim.side = Math.max(-1, Math.min(1, x))
      const speed = phoneSwing.sample(y, performance.now() / 1000)
      if (speed !== null) {
        const st = strengthOf(speed)
        doSwing(st, st > 0.85)
      }
    },
    onAction: (action) => {
      const ph = live.current.phase
      if (action === 'primary') {
        if (ph === 'play') doSwing(0.6)
        else start()
      } else if (action === 'menu' && ph !== 'setup') toSetup()
    },
  }

  // what the phone shows
  useEffect(() => {
    ctrl.send({ type: 'state', mode: phase, you: score[0], them: score[1], serving: phase === 'play' && server === 0, last: banner?.title ?? '', tone: banner?.tone ?? '' })
  }, [phase, score, server, banner, ctrl.send, ctrl.phones])

  // ---- mouse and touch: point at their court to aim, click or tap to swing ----
  const aimFrom = (e: PointerEvent<HTMLDivElement>) => {
    const m = match.current
    if (!m) return
    const r = e.currentTarget.getBoundingClientRect()
    m.aim.side = Math.max(-1, Math.min(1, (((e.clientX - r.left) / r.width) * 2 - 1) * 1.5))
    // their court is the upper part of the screen: the top is their baseline, the middle the net
    m.aim.depth = Math.max(0, Math.min(1, 1 - ((e.clientY - r.top) / r.height - 0.1) / 0.45))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'play' || ctrl.ready || e.pointerType !== 'mouse') return
    aimFrom(e)
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'play' || ctrl.ready) return
    aimFrom(e)
    doSwing(0.6, e.button === 2 || e.shiftKey)
  }

  // Fullscreen
  const appRef = useRef<HTMLDivElement>(null)
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === appRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])
  const toggleFullscreen = useCallback(() => {
    if (!canFullscreen) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else appRef.current?.requestFullscreen().catch(() => {})
  }, [canFullscreen])

  // Space swings, S smashes, the arrows aim, Enter starts, M menu, F fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || courtRoom) return
      const m = match.current
      const ph = live.current.phase
      if (ph === 'play' && m) {
        if (e.code === 'ArrowLeft') m.aim.side = Math.max(-1, m.aim.side - 0.15)
        else if (e.code === 'ArrowRight') m.aim.side = Math.min(1, m.aim.side + 0.15)
        else if (e.code === 'ArrowUp') m.aim.depth = Math.min(1, m.aim.depth + 0.15)
        else if (e.code === 'ArrowDown') m.aim.depth = Math.max(0, m.aim.depth - 0.15)
      }
      if (e.repeat) return
      if (e.code === 'Space' && ph === 'play') {
        e.preventDefault()
        doSwing(0.6)
      } else if (e.code === 'KeyS' && ph === 'play') doSwing(1, true)
      else if (e.code === 'Enter' && ph !== 'play') start()
      else if (e.code === 'KeyM' && ph !== 'setup') toSetup()
      else if (e.code === 'KeyF') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSwing, start, toSetup, toggleFullscreen, courtRoom])

  const m = match.current
  const gamePoint = phase === 'play' && m ? [0, 1].some((s) => score[s] >= setup.to - 1 && score[s] > score[1 - s]) : false
  const yourServe = phase === 'play' && m?.phase === 'serve' && server === 0

  return createPortal(
    <div className={styles.app} ref={appRef}>
      <div className={styles.stage} onPointerMove={onPointerMove} onPointerDown={onPointerDown} onContextMenu={(e) => e.preventDefault()}>
        <Arena match={match} onEvents={onEvents} aimVisible={aimVisible} sound={sound && phase !== 'setup'} paused={courtRoom} />
      </div>

      <div className={styles.corner}>
        <button type="button" className={styles.roundBtn} onClick={() => setSound((s) => !s)} aria-label={sound ? 'Sound off' : 'Sound on'} title={sound ? 'Sound off' : 'Sound on'}>
          {sound ? '🔊' : '🔈'}
        </button>
        {canFullscreen && (
          <button type="button" className={styles.roundBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isFullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        )}
        {phase !== 'setup' && (
          <button type="button" className={styles.roundBtn} onClick={toSetup} aria-label="Menu (M)" title="Menu (M)">
            ☰
          </button>
        )}
      </div>

      {phase === 'play' && (
        <>
          <div className={styles.board} aria-live="polite">
            <div className={styles.row} data-serve={server === 0 ? '' : undefined}>
              <span>{you}</span>
              <b>{score[0]}</b>
            </div>
            <div className={styles.row} data-serve={server === 1 ? '' : undefined}>
              <span>Computer · {DIFFICULTY[setup.difficulty].name.toLowerCase()}</span>
              <b>{score[1]}</b>
            </div>
            <div className={styles.meta}>
              Game to {setup.to}
              {gamePoint ? ' · game point' : ''}
              {rally > 1 ? ` · last rally ${rally} shots` : ''}
            </div>
          </div>
          {banner && (
            <div key={banner.n} className={styles.banner} data-tone={banner.tone} role="status">
              <b>{banner.title}</b>
              <span>{banner.detail}</span>
            </div>
          )}
          <p className={styles.hint}>
            {yourServe
              ? `Your serve, from the ${m ? serveCourt(m.score) : 'right'} court. ${ctrl.ready ? 'Swing your phone' : touch ? 'Tap' : 'Click or press Space'} to serve${ctrl.ready ? '' : ' (aim near the net for a low serve, deep for a high one)'}.`
              : ctrl.ready
                ? 'Tilt your phone to aim, then swing it back and through as the shuttle comes to you. Soft for a drop, hard to smash.'
                : touch
                  ? 'Tap their court where you want it to go, just as the shuttle reaches you.'
                  : 'Point at their court to aim. Click (or Space) as the shuttle reaches you. Right-click or S to smash.'}
          </p>
        </>
      )}

      {phase === 'over' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={styles.h2}>{winner === 0 ? 'You win!' : 'Game to the computer'}</h2>
            <div className={styles.final}>
              {score[0]}
              <small> – </small>
              {score[1]}
            </div>
            <p className={styles.tag}>
              {DIFFICULTY[setup.difficulty].name} computer · game to {setup.to}
              {best > 1 ? ` · longest rally ${best} shots` : ''}
            </p>
            <button type="button" className={styles.btn} onClick={start}>
              Play again
            </button>
            <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={toSetup}>
              Menu
            </button>
          </div>
        </div>
      )}

      {phase === 'setup' && (
        <div className={[styles.overlay, styles.menu].join(' ')}>
          <Link to="/games" className={styles.leave}>
            <BackArrow /> Games
          </Link>
          <div className={styles.panel}>
            <h1 className={styles.h1}>
              Badminton<span>Singles</span>
            </h1>
            <p className={styles.tag}>You against the computer on a full-size court. Rally scoring.</p>
            <div className={styles.choices} role="group" aria-label="Computer">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <button key={d} type="button" className={styles.choice} aria-pressed={setup.difficulty === d} onClick={() => setSetup((s) => ({ ...s, difficulty: d }))}>
                  <b>{DIFFICULTY[d].name}</b>
                </button>
              ))}
            </div>
            <div className={styles.choices} data-two="" role="group" aria-label="Game to">
              {([11, 21] as const).map((to) => (
                <button key={to} type="button" className={styles.choice} aria-pressed={setup.to === to} onClick={() => setSetup((s) => ({ ...s, to }))}>
                  <b>Game to {to}</b>
                  <small>{to === 11 ? 'quick' : 'the full game'}</small>
                </button>
              ))}
            </div>
            <button type="button" className={styles.btn} onClick={start}>
              Start
            </button>
            {!touch && (
              <PhonePanel
                ctrl={ctrl}
                gameName="Badminton"
                linked={
                  <>
                    Phone linked. Hold it like the racket, then press <b>Start</b> on your phone.
                  </>
                }
              />
            )}
            <button type="button" className={styles.linkBtn} onClick={() => setCourtRoom(true)}>
              Walk round the court
            </button>
            <ControlsInfo touch={touch} />
          </div>
        </div>
      )}

      {courtRoom && <CourtRoom onClose={() => setCourtRoom(false)} />}
    </div>,
    document.body,
  )
}

function CourtRoom({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={styles.room} role="dialog" aria-label="The court">
      <div className={styles.roomBar}>
        <span>The court</span>
        <button type="button" className={styles.roundBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className={styles.roomStage}>
        <Suspense fallback={<p className={styles.loading}>Loading…</p>}>
          <CourtModel height="100%" />
        </Suspense>
      </div>
    </div>
  )
}

const KEY_ROWS: [keys: string[], action: string][] = [
  [['Mouse'], 'Point at their court to aim'],
  [['Click', 'Space'], 'Swing (and serve)'],
  [['Right-click', 'S'], 'Smash a high shuttle'],
  [['←', '→', '↑', '↓'], 'Move your aim'],
  [['M'], 'Menu'],
  [['F'], 'Fullscreen'],
  [['Phone'], 'Scan the QR code, then swing your phone like a racket'],
]
const TOUCH_ROWS: [keys: string[], action: string][] = [
  [['Tap'], 'Swing, aimed where you tap on their court'],
  [['Timing'], 'Tap just as the shuttle reaches you'],
]

function ControlsInfo({ touch }: { touch: boolean }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const popId = useId()
  useEffect(() => {
    if (!open) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const rows = touch ? TOUCH_ROWS : KEY_ROWS
  return (
    <div className={styles.info} ref={boxRef}>
      <button type="button" className={styles.infoBtn} aria-label="Controls" aria-expanded={open} aria-controls={popId} onClick={() => setOpen((o) => !o)}>
        i
      </button>
      {open && (
        <div id={popId} className={styles.infoPop} role="dialog" aria-label="Controls">
          <h2 className={styles.infoTitle}>Controls</h2>
          <dl className={styles.infoList}>
            {rows.map(([keys, action]) => (
              <div key={action}>
                <dt>
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
