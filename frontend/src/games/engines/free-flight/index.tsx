import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { PhonePanel } from '../../controller/PhonePanel'
import { usePhoneController, type ControllerHandlers } from '../../controller/usePhoneController'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import { Game, type FlightHud } from './engine/Game'
import { FlyGame, type FlyHud, type FlyScene } from './fly-engine/FlyGame'
import styles from './FreeFlight.module.css'

// Free Flight: a single-player flying sandbox with four modes, no score and no crashing. It fills the window over
// the app. Two plain three.js engines sit behind it (both from gyro_games): engine/ (Game: the sunset sea and the
// nebula, with camera views, roll and brake) and fly-engine/ (FlyGame: the sky islands and the asteroid belt).
// Picking a mode from the other engine swaps the engine in place. This file is the screen around them: the menu,
// the gauges and the pause card. Flown with the keyboard, by dragging, or with a phone: the menu shows a QR code
// when the dev server's controller relay is running (usePhoneController). Touch screens get a hold-to-boost button.

type EngineKind = 'flight' | 'fly'
type ModeId = 'sunset' | 'islands' | 'nebula' | 'asteroids'
type Mode = { id: ModeId; name: string; engine: EngineKind; world?: number; scene?: FlyScene }

const MODES: Mode[] = [
  { id: 'sunset', name: 'Sunset Sea', engine: 'flight', world: 0 },
  { id: 'islands', name: 'Sky Islands', engine: 'fly', scene: 'sky' },
  { id: 'nebula', name: 'Nebula', engine: 'flight', world: 1 },
  { id: 'asteroids', name: 'Asteroid Belt', engine: 'fly', scene: 'space' },
]
const modeById = (id: ModeId) => MODES.find((m) => m.id === id) ?? MODES[0]
const isSky = (id: ModeId) => id === 'sunset' || id === 'islands'

const CAM_LABEL: Record<FlightHud['camera'], string> = { chase: 'Chase', far: 'Wide', cockpit: 'Cockpit' }
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const MODE_KEY = 'bp-free-flight-mode'

function loadMode(): ModeId {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return MODES.some((m) => m.id === v) ? (v as ModeId) : 'sunset'
  } catch {
    return 'sunset'
  }
}

function saveMode(id: ModeId) {
  try {
    localStorage.setItem(MODE_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

/** What the screen shows, whichever engine is flying. */
type Hud = {
  paused: boolean
  speed: number
  altitude: number | null
  altNorm: number
  heading: number
  boost: boolean
  /** Only the sunset / nebula engine has camera views. */
  camera: FlightHud['camera'] | null
  /** Only the islands / asteroids engine counts distance (metres). */
  distance: number | null
}

const EMPTY_HUD: Hud = { paused: false, speed: 0, altitude: null, altNorm: 0.5, heading: 0, boost: false, camera: null, distance: null }

const fromFlight = (h: FlightHud): Hud => ({
  paused: h.paused,
  speed: h.speed,
  altitude: h.altitude,
  altNorm: h.altNorm ?? 0.5,
  heading: h.heading,
  boost: !!h.boosting,
  camera: h.camera,
  distance: null,
})

const fromFly = (h: FlyHud): Hud => ({
  paused: h.paused,
  speed: h.speed,
  altitude: h.altitude,
  altNorm: h.altNorm,
  heading: h.heading,
  boost: h.boost,
  camera: null,
  distance: h.distance,
})

/** The running engine, tagged with which one it is. */
type Running = { kind: 'flight'; game: Game } | { kind: 'fly'; game: FlyGame }

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

export default function FreeFlight(_: GameEngineProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const runRef = useRef<Running | null>(null)
  const touch = useCoarsePointer()
  const [phase, setPhase] = useState<'menu' | 'flying'>('menu')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [modeId, setModeId] = useState<ModeId>(loadMode)
  const modeRef = useRef(modeId)
  modeRef.current = modeId
  const [hud, setHud] = useState<Hud>(EMPTY_HUD)
  const pausedRef = useRef(hud.paused)
  pausedRef.current = hud.paused
  const [flash, setFlash] = useState(0) // bumps to replay the mode-switch flash
  const phoneBoost = useRef(false) // the phone's boost button, for the islands / asteroids engine

  /** Show a mode: switch scene inside the running engine, or swap to the other engine. */
  const applyMode = useCallback((mode: Mode): boolean => {
    const mount = mountRef.current
    if (!mount) return false
    let run = runRef.current
    const swap = !run || run.kind !== mode.engine
    if (!run || run.kind !== mode.engine) {
      run?.game.dispose()
      run =
        mode.engine === 'flight'
          ? { kind: 'flight', game: new Game(mount, { onHud: (h) => setHud(fromFlight(h)) }) }
          : { kind: 'fly', game: new FlyGame(mount, { onHud: (h) => setHud(fromFly(h)) }) }
      runRef.current = run
      if (phaseRef.current === 'flying') run.game.start()
    }
    if (run.kind === 'flight') run.game.setWorld(mode.world ?? 0)
    else run.game.setScene(mode.scene ?? 'sky')
    return swap
  }, [])

  useEffect(() => {
    applyMode(modeById(modeRef.current))
    return () => {
      runRef.current?.game.dispose()
      runRef.current = null
    }
  }, [applyMode])

  // ---- phone controller (QR code on the menu) ----
  const phoneHandlers = useRef<ControllerHandlers>({})
  const ctrl = usePhoneController('free-flight', phoneHandlers)
  const sendRef = useRef(ctrl.send)
  sendRef.current = ctrl.send

  const chooseMode = useCallback(
    (id: ModeId) => {
      if (id === modeRef.current && runRef.current) return
      const swapped = applyMode(modeById(id))
      modeRef.current = id
      setModeId(id)
      saveMode(id)
      setFlash((n) => n + 1)
      sendRef.current({ type: 'haptic', pattern: 'double' })
      // a swapped-in engine starts unpaused; keep the pause card up if it was showing
      if (swapped && pausedRef.current) runRef.current?.game.togglePause()
    },
    [applyMode],
  )

  const nextMode = useCallback(() => {
    const i = MODES.findIndex((m) => m.id === modeRef.current)
    chooseMode(MODES[(i + 1) % MODES.length].id)
  }, [chooseMode])

  const start = useCallback(() => {
    runRef.current?.game.start()
    setPhase('flying')
    sendRef.current({ type: 'calibrate' }) // the phone's current grip becomes "level"
  }, [])

  const toMenu = useCallback(() => {
    const run = runRef.current
    if (run?.kind === 'fly') run.game.setBoost(false)
    run?.game.toMenu()
    setPhase('menu')
  }, [])

  const togglePause = useCallback(() => runRef.current?.game.togglePause(), [])
  const cycleCamera = useCallback(() => {
    const run = runRef.current
    if (run?.kind === 'flight') run.game.cycleCamera()
  }, [])
  const respawn = useCallback(() => {
    const run = runRef.current
    if (run?.kind === 'flight') run.game.respawn()
  }, [])

  phoneHandlers.current = {
    onTilt: (x, y) => {
      const run = runRef.current
      if (run?.kind === 'flight') run.game.setRemoteInput(x, y)
      else run?.game.setRemoteInput(x, y, phoneBoost.current)
    },
    onAction: (action) => {
      const run = runRef.current
      if (!run) return
      if (action === 'primary') {
        if (phaseRef.current === 'menu') start()
        else run.game.togglePause()
      } else if (action === 'menu') {
        if (phaseRef.current !== 'menu') toMenu()
      } else if (action === 'scene') nextMode()
      else if (action === 'view') cycleCamera()
      else if (action === 'respawn') respawn()
      else if (action === 'boost-on' || action === 'boost-off') {
        phoneBoost.current = action === 'boost-on'
        if (run.kind === 'flight') run.game.setRemoteButton('boost', phoneBoost.current)
      } else if (run.kind === 'flight' && (action === 'brake-on' || action === 'brake-off'))
        run.game.setRemoteButton('brake', action === 'brake-on')
    },
  }

  const mode = modeById(modeId)

  // What the phone shows: mode, speed, altitude, scene, camera.
  useEffect(() => {
    ctrl.send({
      type: 'state',
      mode: phase,
      paused: hud.paused,
      speed: hud.speed,
      altitude: hud.altitude,
      altNorm: hud.altNorm,
      world: mode.name,
      camera: hud.camera ? CAM_LABEL[hud.camera] : '–',
    })
  }, [hud, phase, mode.name, ctrl.send, ctrl.phones])

  // a tap on the phone when boost kicks in
  const wasBoosting = useRef(false)
  useEffect(() => {
    if (phase === 'flying' && hud.boost && !wasBoosting.current) ctrl.send({ type: 'haptic', pattern: 'tap' })
    wasBoosting.current = hud.boost
  }, [hud.boost, phase, ctrl.send])

  // Fullscreen: the whole game (canvas and HUD), toggled with F or the corner button.
  const appRef = useRef<HTMLDivElement>(null)
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === appRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      // leaving the game page should not leave the browser stuck in fullscreen
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])
  const toggleFullscreen = useCallback(() => {
    if (!canFullscreen) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else appRef.current?.requestFullscreen().catch(() => {})
  }, [canFullscreen])

  // Enter or Space takes off from the menu, N or 1–4 switch mode, M goes back to the menu, F toggles fullscreen.
  // (The engines handle the flying keys, Shift for boost, P / Escape for pause, and in the sunset / nebula engine
  // C for camera, R to respawn, Q / E to roll and Space to brake.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.code === 'Enter' || e.code === 'Space') && phaseRef.current === 'menu') {
        e.preventDefault()
        start()
      } else if (e.code === 'KeyN') nextMode()
      else if (/^Digit[1-4]$/.test(e.code)) chooseMode(MODES[Number(e.code[5]) - 1].id)
      else if (e.code === 'KeyF') toggleFullscreen()
      else if (e.code === 'KeyM' && phaseRef.current === 'flying') toMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, toMenu, nextMode, chooseMode, toggleFullscreen])

  const boostDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const run = runRef.current
    if (run?.kind === 'fly') run.game.setBoost(true)
    else run?.game.setRemoteButton('boost', true)
  }
  const boostUp = () => {
    const run = runRef.current
    if (run?.kind === 'fly') run.game.setBoost(false)
    else run?.game.setRemoteButton('boost', phoneBoost.current)
  }

  const compass = COMPASS[Math.round(hud.heading / 45) % 8]
  const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]

  // Rendered into <body>: inside the page the app shell's layers (top bar, tab dock) would draw over the game.
  return createPortal(
    <div className={styles.app} data-sky={isSky(modeId)} ref={appRef}>
      <div className={styles.stage} ref={mountRef} />
      <div className={styles.vignette} />
      {flash > 0 && <div key={flash} className={styles.flash} />}
      {canFullscreen && (
        <button
          type="button"
          className={[styles.fsBtn, phase === 'menu' ? styles.fsMenu : ''].join(' ')}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={isFullscreen ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
          </svg>
        </button>
      )}

      {phase === 'flying' && (
        <>
          <div className={styles.hud}>
            <Gauge label="SPD" value={hud.speed} unit="km/h" />
            {hud.altitude != null && <Gauge label="ALT" value={hud.altitude} unit="m" />}
            <Gauge label="HDG" value={`${String(hud.heading).padStart(3, '0')}°`} unit={compass} />
            {hud.distance != null && <Gauge label="FLOWN" value={(hud.distance / 1000).toFixed(1)} unit="km" />}
          </div>
          <div className={styles.topbar}>
            <span className={styles.chip}>{mode.name}</span>
            {hud.camera && <span className={styles.chip}>{CAM_LABEL[hud.camera]} cam</span>}
            {hud.boost && !hud.paused && <span className={[styles.chip, styles.boost].join(' ')}>Boost</span>}
          </div>
          {touch && !hud.paused && (
            <button
              type="button"
              className={styles.boostBtn}
              aria-label="Boost (hold)"
              onPointerDown={boostDown}
              onPointerUp={boostUp}
              onPointerCancel={boostUp}
              onLostPointerCapture={boostUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              Boost
            </button>
          )}
          <button type="button" className={styles.pauseBtn} onClick={togglePause} aria-label={hud.paused ? 'Resume' : 'Pause'}>
            {hud.paused ? '▶' : '❚❚'}
          </button>
          {hud.paused && (
            <div className={styles.overlay}>
              <div className={styles.panel}>
                <h2 className={styles.h2}>Paused</h2>
                <button type="button" className={styles.btn} onClick={togglePause}>
                  Resume
                </button>
                <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={nextMode}>
                  Go to {next.name}
                </button>
                <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={toMenu}>
                  Menu
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {phase === 'menu' && (
        <div className={[styles.overlay, styles.menu].join(' ')}>
          <Link to="/games" className={styles.leave}>
            <BackArrow /> Games
          </Link>
          <div className={styles.panel}>
            <h1 className={styles.h1}>
              Free<span>Flight</span>
            </h1>
            <p className={styles.tag}>No score. No crashes. Just fly.</p>
            <div className={styles.scenes} role="group" aria-label="Flight mode">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={styles.sceneBtn}
                  aria-pressed={modeId === m.id}
                  onClick={() => chooseMode(m.id)}
                >
                  <i className={styles.swatch} data-mode={m.id} />
                  {m.name}
                </button>
              ))}
            </div>
            <button type="button" className={styles.btn} onClick={start}>
              Take off
            </button>
            {!touch && <PhonePanel ctrl={ctrl} gameName="Free Flight" />}
            <ControlsInfo touch={touch} />
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

// The controls, tucked behind an "i" button in the corner of the menu card. Opens on click, closes on a click
// outside it, on Escape, or on the button again. Keyboard rows on a computer, touch rows on a phone or tablet.
const KEY_ROWS: [keys: string[], action: string][] = [
  [['A', 'D', '←', '→'], 'Turn'],
  [['W', 'S', '↑', '↓'], 'Climb · dive'],
  [['Shift'], 'Boost'],
  [['N', '1–4'], 'Switch mode'],
  [['P', 'Esc'], 'Pause'],
  [['M'], 'Back to menu'],
  [['F'], 'Fullscreen'],
  [['Drag'], 'Steer with the mouse'],
  [['Q', 'E'], 'Roll (Sunset Sea, Nebula)'],
  [['Space'], 'Brake (Sunset Sea, Nebula)'],
  [['C', 'R'], 'Camera · respawn (Sunset Sea, Nebula)'],
]
const TOUCH_ROWS: [keys: string[], action: string][] = [
  [['Drag'], 'Press and drag from the centre to steer'],
  [['Boost'], 'Hold the round button to go fast'],
  [['❚❚'], 'Pause or switch mode'],
  [['⛶'], 'Fullscreen'],
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
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
      <button
        type="button"
        className={styles.infoBtn}
        aria-label="Controls"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((o) => !o)}
      >
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

function Gauge({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className={styles.gauge}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{unit}</small>
    </div>
  )
}
