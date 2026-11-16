import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { PhonePanel } from '../../../controller/PhonePanel'
import { usePhoneController, type ControllerHandlers } from '../../../controller/usePhoneController'
import { BackArrow } from '../../../room/BackArrow'
import NetsScene, { type BatInput, type NetsView } from './NetsScene'
import { BALLS_PER_SESSION, PACES, WICKETS_PER_SESSION, overs, score, type Delivery, type Outcome, type Pace } from './shot'
import { PALM, handOffset, useHandTracking, type HandSample } from './useHandTracking'
import styles from './Nets.module.css'

// Cricket nets: a single-player batting game in 3D. The bowling machine fires cricket balls down a full-size pitch and
// you swing the bat: with your phone held like the handle (the same phone controller as Free Flight, through the dev
// server's relay and a QR code on the menu), with the mouse or a finger (down to lift the bat, flick up to swing), or
// with the Space bar for a timed drive. Two overs, three wickets: score what you can.
// The models (the bat, the pitch, the bowling machine and its balls) are in this folder; the menu's kit room shows each
// one on its own.

const CricketBatModel = lazy(() => import('./models/CricketBatModel.jsx'))
const CricketPitchModel = lazy(() => import('./models/CricketPitchModel.jsx'))
const BowlingMachineModel = lazy(() => import('./models/BowlingMachineModel.jsx'))

type Phase = 'menu' | 'playing' | 'over'
type Kit = 'bat' | 'pitch' | 'machine'

const VIEWS: { id: NetsView; name: string }[] = [
  { id: 'batter', name: 'Batter' },
  { id: 'side', name: 'Side on' },
  { id: 'stumps', name: 'Behind the stumps' },
  { id: 'machine', name: 'Behind the machine' },
]
const PACE_KEY = 'bp-cricket-nets-pace'
const BEST_KEY = 'bp-cricket-nets-best'
const BETWEEN_BALLS = 2200 // ms from one ball ending to the next being fed

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

/** True on phones and tablets (no fine pointer to hover with). */
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

export default function Nets() {
  const touch = useCoarsePointer()
  const [phase, setPhase] = useState<Phase>('menu')
  const [paused, setPaused] = useState(false)
  const [pace, setPace] = useState<Pace>(() => load(PACE_KEY, PACES.map((p) => p.id), 'medium'))
  const [view, setView] = useState<NetsView>('batter')
  const [sound, setSound] = useState(true)
  const [webcam, setWebcam] = useState(false)
  const [bowl, setBowl] = useState(0)
  const [runs, setRuns] = useState(0)
  const [wickets, setWickets] = useState(0)
  const [balls, setBalls] = useState(0)
  const [last, setLast] = useState<(Outcome & { n: number }) | null>(null)
  const [kmh, setKmh] = useState<number | null>(null)
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0
    } catch {
      return 0
    }
  })
  const [kit, setKit] = useState<Kit | null>(null)

  // Refs for the callbacks the scene and the phone call from outside React's render.
  const live = useRef({ phase, paused, runs, wickets, balls, waiting: false })
  live.current = { ...live.current, phase, paused, runs, wickets, balls }
  const input = useRef<BatInput>({ x: 0, y: 0, auto: 0 })
  const nextTimer = useRef<number | undefined>(undefined)

  // ---- webcam: where the hands are (the phone or the mouse still gives the bat's angle) ----
  // The hands' resting place is taken from the first frame after the webcam starts, or after taking guard.
  const handHome = useRef<HandSample | null>(null)
  const tracker = useHandTracking(webcam, (h) => {
    if (!h) return // out of view: the grip stays where it was
    if (!handHome.current) handHome.current = h
    input.current.hands = handOffset(handHome.current, h)
  })
  useEffect(() => {
    handHome.current = null
    if (!webcam) input.current.hands = null
  }, [webcam])

  // ---- phone controller (QR code on the menu) ----
  const phoneHandlers = useRef<ControllerHandlers>({})
  const ctrl = usePhoneController('cricket', phoneHandlers)
  const sendRef = useRef(ctrl.send)
  sendRef.current = ctrl.send

  const queueBall = useCallback((delay: number) => {
    window.clearTimeout(nextTimer.current)
    live.current.waiting = true
    nextTimer.current = window.setTimeout(() => {
      live.current.waiting = false
      if (live.current.phase === 'playing' && !live.current.paused) setBowl((b) => b + 1)
    }, delay)
  }, [])
  useEffect(() => () => window.clearTimeout(nextTimer.current), [])

  const start = useCallback(() => {
    setRuns(0)
    setWickets(0)
    setBalls(0)
    setLast(null)
    setPaused(false)
    setPhase('playing')
    live.current.phase = 'playing'
    live.current.paused = false
    input.current = { x: 0, y: 0, auto: 0 }
    handHome.current = null // and where the webcam sees the hands now becomes their resting place
    sendRef.current({ type: 'calibrate' }) // the phone's current grip becomes the stance
    queueBall(900)
  }, [queueBall])

  const toMenu = useCallback(() => {
    window.clearTimeout(nextTimer.current)
    setPhase('menu')
    setPaused(false)
  }, [])

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p
      live.current.paused = next
      // resuming with no ball on its way: bowl the next one
      if (!next && live.current.phase === 'playing' && !live.current.waiting) queueBall(700)
      return next
    })
  }, [queueBall])

  const cyclePace = useCallback(() => {
    setPace((p) => {
      const i = PACES.findIndex((x) => x.id === p)
      const next = PACES[(i + 1) % PACES.length].id
      save(PACE_KEY, next)
      return next
    })
  }, [])

  phoneHandlers.current = {
    onTilt: (x, y, _boost, q) => {
      input.current.x = x
      input.current.y = y
      // a phone that sends its full turn moves the bat freely; an older controller page still swings it on x and y
      input.current.q = q ?? null
    },
    onAction: (action) => {
      const ph = live.current.phase
      if (action === 'primary') {
        if (ph === 'playing') togglePause()
        else start()
      } else if (action === 'menu' && ph !== 'menu') toMenu()
      else if (action === 'pace') cyclePace()
    },
  }

  // ---- what the scene reports ----
  const onDelivery = useCallback(
    (d: Delivery) => {
      if (live.current.phase !== 'playing') return
      const o = score(d)
      const r = live.current.runs + o.runs
      const w = live.current.wickets + (o.wicket ? 1 : 0)
      const b = live.current.balls + 1
      setRuns(r)
      setWickets(w)
      setBalls(b)
      setLast((prev) => ({ ...o, n: (prev?.n ?? 0) + 1 }))
      sendRef.current({ type: 'haptic', pattern: o.tone === 'wicket' ? 'long' : o.tone === 'boundary' ? 'triple' : 'double' })
      if (b >= BALLS_PER_SESSION || w >= WICKETS_PER_SESSION) {
        window.clearTimeout(nextTimer.current)
        live.current.phase = 'over'
        nextTimer.current = window.setTimeout(() => {
          setPhase('over')
          setBest((old) => {
            if (r <= old) return old
            save(BEST_KEY, String(r))
            return r
          })
        }, 1600)
      } else queueBall(BETWEEN_BALLS)
    },
    [queueBall],
  )
  const onContact = useCallback(() => sendRef.current({ type: 'haptic', pattern: 'tap' }), [])
  const onReport = useCallback((r: { kmh: number }) => setKmh(r.kmh), [])

  // What the phone shows.
  const paceName = PACES.find((p) => p.id === pace)?.name ?? 'Medium'
  useEffect(() => {
    ctrl.send({
      type: 'state',
      mode: phase,
      paused,
      runs,
      wickets,
      overs: overs(balls),
      pace: paceName,
      last: last ? last.title : phase === 'over' ? 'Innings over' : '',
      wicket: !!last?.wicket,
    })
  }, [phase, paused, runs, wickets, balls, paceName, last, ctrl.send, ctrl.phones])

  // A phone that stops sending lets go of the bat, so it doesn't stay frozen at the phone's last angle.
  useEffect(() => {
    if (!ctrl.ready) input.current.q = null
  }, [ctrl.ready])

  // ---- mouse and touch: down lifts the bat, up swings it through ----
  const pointerDown = useRef(false)
  const steer = (e: PointerEvent<HTMLDivElement>) => {
    if (ctrl.ready || phase !== 'playing') return
    if (e.pointerType !== 'mouse' && !pointerDown.current) return
    input.current.q = null
    const r = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1
    input.current.x = Math.max(-1, Math.min(1, nx * 1.6))
    // the lower half of the screen is the backlift, the upper half the follow-through
    input.current.y = Math.max(-1, Math.min(1, (ny - 0.1) * 1.8))
  }

  // Fullscreen: the whole game, toggled with F or the corner button.
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

  // Space swings (a timed drive), Enter starts, P pauses, V changes the view, M is the menu, F fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || kit) return
      const ph = live.current.phase
      if (e.code === 'Space' && ph === 'playing') {
        e.preventDefault()
        input.current.auto = performance.now()
      } else if (e.code === 'Enter' && ph !== 'playing') {
        e.preventDefault()
        start()
      } else if ((e.code === 'KeyP' || e.code === 'Escape') && ph === 'playing') togglePause()
      else if (e.code === 'KeyV') setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length].id)
      else if (e.code === 'KeyM' && ph !== 'menu') toMenu()
      else if (e.code === 'KeyF') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, togglePause, toMenu, toggleFullscreen, kit])

  return createPortal(
    <div className={styles.app} ref={appRef}>
      <div
        className={styles.stage}
        onPointerMove={steer}
        onPointerDown={(e) => {
          pointerDown.current = true
          steer(e)
        }}
        onPointerUp={() => {
          pointerDown.current = false
        }}
        onPointerCancel={() => {
          pointerDown.current = false
        }}
      >
        <NetsScene
          view={view}
          pace={pace}
          bowl={bowl}
          input={input}
          sound={sound && phase !== 'menu'}
          onDelivery={onDelivery}
          onContact={onContact}
          onReport={onReport}
        />
      </div>
      <div className={styles.vignette} />

      {webcam && (
        <div className={styles.cam}>
          {/* mirrored, so moving your hand right moves it right here too */}
          <div className={styles.camView}>
            <video ref={tracker.videoRef} muted playsInline />
            <svg viewBox="0 0 1 0.75" preserveAspectRatio="none" aria-hidden="true">
              {tracker.hands.flatMap((lm, i) =>
                lm.map((p, j) => <circle key={`${i}-${j}`} cx={p.x} cy={p.y * 0.75} r={PALM.includes(j) ? 0.012 : 0.006} />),
              )}
            </svg>
          </div>
          <div className={styles.camBar}>
            <span>{tracker.status}</span>
            <button type="button" onClick={() => (handHome.current = null)} title="Where your hands are now becomes the stance">
              Re-centre
            </button>
          </div>
        </div>
      )}

      <div className={styles.corner}>
        <button type="button" className={styles.roundBtn} onClick={() => setSound((s) => !s)} aria-label={sound ? 'Sound off' : 'Sound on'} title={sound ? 'Sound off' : 'Sound on'}>
          {sound ? '🔊' : '🔈'}
        </button>
        <button
          type="button"
          className={styles.roundBtn}
          onClick={() => setWebcam((w) => !w)}
          aria-pressed={webcam}
          aria-label={webcam ? 'Stop tracking hands with the webcam' : 'Track hands with the webcam'}
          title={webcam ? 'Stop tracking hands with the webcam' : 'Track hands with the webcam'}
        >
          📷
        </button>
        {canFullscreen && (
          <button type="button" className={styles.roundBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isFullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        )}
        {phase === 'playing' && (
          <button type="button" className={styles.roundBtn} onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
            {paused ? '▶' : '❚❚'}
          </button>
        )}
      </div>

      {phase !== 'menu' && (
        <>
          <div className={styles.board} aria-live="polite">
            <div className={styles.total}>
              {runs}/{wickets}
            </div>
            <div className={styles.meta}>
              <span>
                {overs(balls)} of {overs(BALLS_PER_SESSION)} overs
              </span>
              <span>
                {paceName}
                {kmh ? ` · ${kmh} km/h` : ''}
              </span>
            </div>
          </div>
          <div className={styles.views} role="group" aria-label="Camera">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                {v.name}
              </button>
            ))}
          </div>
          {last && phase === 'playing' && (
            <div key={last.n} className={styles.banner} data-tone={last.tone} role="status">
              <b>{last.title}</b>
              <span>{last.detail}</span>
            </div>
          )}
          {phase === 'playing' && !paused && (
            <p className={styles.hint}>
              {ctrl.ready
                ? 'The bat copies your phone. Swing it like a real bat: lift it back, then bring it down through the ball.'
                : touch
                  ? 'Drag down to lift the bat, flick up through the ball to swing.'
                  : 'Mouse down to lift the bat, flick it up through the ball. Or press Space.'}
            </p>
          )}
          {touch && phase === 'playing' && !ctrl.ready && !paused && (
            <button type="button" className={styles.swingBtn} onPointerDown={() => (input.current.auto = performance.now())}>
              Swing
            </button>
          )}
        </>
      )}

      {paused && phase === 'playing' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={styles.h2}>Paused</h2>
            <button type="button" className={styles.btn} onClick={togglePause}>
              Resume
            </button>
            <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={toMenu}>
              Menu
            </button>
          </div>
        </div>
      )}

      {phase === 'over' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={styles.h2}>Innings over</h2>
            <div className={styles.final}>
              {runs}
              <small>/{wickets}</small>
            </div>
            <p className={styles.tag}>
              {overs(balls)} overs at {paceName.toLowerCase()} pace · best {Math.max(best, runs)}
              {runs > 0 && runs >= best ? ' · new best!' : ''}
            </p>
            <button type="button" className={styles.btn} onClick={start}>
              Bat again
            </button>
            <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={toMenu}>
              Menu
            </button>
          </div>
        </div>
      )}

      {phase === 'menu' && (
        <div className={[styles.overlay, styles.menu].join(' ')}>
          <Link to="/games" className={styles.leave}>
            <BackArrow /> Games
          </Link>
          <div className={styles.panel}>
            <h1 className={styles.h1}>
              Cricket<span>Nets</span>
            </h1>
            <p className={styles.tag}>
              Face the bowling machine. {overs(BALLS_PER_SESSION)} overs, {WICKETS_PER_SESSION} wickets.
              {best > 0 ? ` Your best: ${best}.` : ''}
            </p>
            <div className={styles.choices} role="group" aria-label="Pace">
              {PACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.choice}
                  aria-pressed={pace === p.id}
                  onClick={() => {
                    setPace(p.id)
                    save(PACE_KEY, p.id)
                  }}
                >
                  <b>{p.name}</b>
                  <small>{p.kmh} km/h</small>
                </button>
              ))}
            </div>
            <button type="button" className={styles.btn} onClick={start}>
              Take guard
            </button>
            {!touch && (
              <PhonePanel
                ctrl={ctrl}
                gameName="Cricket nets"
                linked={
                  <>
                    Phone linked. Hold it like a bat handle, then press <b>Start</b> on your phone.
                  </>
                }
              />
            )}
            <div className={styles.kit}>
              <span>Kit room</span>
              <button type="button" onClick={() => setKit('bat')}>
                Bat
              </button>
              <button type="button" onClick={() => setKit('pitch')}>
                Pitch
              </button>
              <button type="button" onClick={() => setKit('machine')}>
                Bowling machine
              </button>
            </div>
            <ControlsInfo touch={touch} />
          </div>
        </div>
      )}

      {kit && <KitRoom kit={kit} onKit={setKit} onClose={() => setKit(null)} />}
    </div>,
    document.body,
  )
}

// The models on their own, each in its own studio scene with its own controls.
function KitRoom({ kit, onKit, onClose }: { kit: Kit; onKit: (k: Kit) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const tabs: { id: Kit; name: string }[] = [
    { id: 'bat', name: 'Bat' },
    { id: 'pitch', name: 'Pitch' },
    { id: 'machine', name: 'Bowling machine' },
  ]
  return (
    <div className={styles.kitRoom} role="dialog" aria-label="Kit room">
      <div className={styles.kitBar}>
        <div className={styles.views} role="tablist" aria-label="Model">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={kit === t.id} aria-pressed={kit === t.id} onClick={() => onKit(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        <button type="button" className={styles.roundBtn} onClick={onClose} aria-label="Close the kit room">
          ✕
        </button>
      </div>
      <div className={styles.kitStage}>
        <Suspense fallback={<p className={styles.loading}>Loading…</p>}>
          {kit === 'bat' && <CricketBatModel key="bat" height="100%" sound />}
          {kit === 'pitch' && <CricketPitchModel key="pitch" height="100%" setting="field" />}
          {kit === 'machine' && <BowlingMachineModel key="machine" height="100%" ball="cricket" sound />}
        </Suspense>
      </div>
    </div>
  )
}

const KEY_ROWS: [keys: string[], action: string][] = [
  [['Mouse ↓'], 'Lift the bat'],
  [['Mouse ↑'], 'Swing through (flick it)'],
  [['Mouse ←', '→'], 'Move across the crease'],
  [['Space'], 'A timed drive'],
  [['V'], 'Change the camera'],
  [['P', 'Esc'], 'Pause'],
  [['M'], 'Back to menu'],
  [['F'], 'Fullscreen'],
  [['Phone'], 'Scan the QR code and swing your phone'],
  [['📷'], 'Webcam: move your hands and the grip follows'],
]
const TOUCH_ROWS: [keys: string[], action: string][] = [
  [['Drag ↓'], 'Lift the bat'],
  [['Flick ↑'], 'Swing through the ball'],
  [['Swing'], 'A timed drive'],
  [['❚❚'], 'Pause'],
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
