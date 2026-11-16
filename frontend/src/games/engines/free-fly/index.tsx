import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { PhonePanel } from '../../controller/PhonePanel'
import { usePhoneController, type ControllerHandlers } from '../../controller/usePhoneController'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import { FlyGame, type FlyHud, type FlyScene } from './engine/FlyGame'
import styles from './FreeFly.module.css'

// Free Fly: a single-player flying sandbox over sky islands or through deep space. No score, no crashing.
// The engine (engine/) is the plain three.js game from gyro_games/free-fly; this file is its screen: the menu,
// the gauges and the pause card. It fills the window over the app and is flown with the keyboard, by dragging, or
// with a phone: the menu shows a QR code when the dev server's controller relay is running (usePhoneController).
// On touch screens there is no Shift key, so a hold-to-boost button appears instead.

const SCENES: { id: FlyScene; name: string }[] = [
  { id: 'sky', name: 'Sky islands' },
  { id: 'space', name: 'Deep space' },
]
const SCENE_NAME: Record<FlyScene, string> = { sky: 'Sky islands', space: 'Deep space' }
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const SCENE_KEY = 'bp-free-fly-scene'

function loadScene(): FlyScene {
  try {
    return localStorage.getItem(SCENE_KEY) === 'space' ? 'space' : 'sky'
  } catch {
    return 'sky'
  }
}

function saveScene(scene: FlyScene) {
  try {
    localStorage.setItem(SCENE_KEY, scene)
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

export default function FreeFly(_: GameEngineProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<FlyGame | null>(null)
  const touch = useCoarsePointer()
  const [phase, setPhase] = useState<'menu' | 'flying'>('menu')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [hud, setHud] = useState<FlyHud>({
    mode: 'menu',
    paused: false,
    scene: loadScene(),
    speed: 0,
    altitude: 0,
    altNorm: 0,
    heading: 0,
    distance: 0,
    boost: false,
  })
  const [flash, setFlash] = useState(0) // bumps to replay the scene-switch flash

  useEffect(() => {
    const game = new FlyGame(mountRef.current!, { onHud: setHud })
    game.setScene(loadScene())
    gameRef.current = game
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [])

  // ---- phone controller (QR code on the menu) ----
  const phoneHandlers = useRef<ControllerHandlers>({})
  const ctrl = usePhoneController('free-fly', phoneHandlers)
  const sendRef = useRef(ctrl.send)
  sendRef.current = ctrl.send

  const chooseScene = useCallback((scene: FlyScene) => {
    const game = gameRef.current
    if (!game || game.sceneName === scene) return
    game.setScene(scene)
    saveScene(scene)
    setFlash((n) => n + 1)
    sendRef.current({ type: 'haptic', pattern: 'double' })
  }, [])

  const toggleScene = useCallback(() => {
    chooseScene(gameRef.current?.sceneName === 'sky' ? 'space' : 'sky')
  }, [chooseScene])

  const start = useCallback(() => {
    gameRef.current?.start()
    setPhase('flying')
    sendRef.current({ type: 'calibrate' }) // the phone's current grip becomes "level"
  }, [])

  const toMenu = useCallback(() => {
    gameRef.current?.setBoost(false)
    gameRef.current?.toMenu()
    setPhase('menu')
  }, [])

  phoneHandlers.current = {
    onTilt: (x, y, boost) => gameRef.current?.setRemoteInput(x, y, boost),
    onAction: (action) => {
      if (action === 'primary') {
        if (phaseRef.current === 'menu') start()
        else gameRef.current?.togglePause()
      } else if (action === 'menu' && phaseRef.current !== 'menu') toMenu()
      else if (action === 'scene') toggleScene()
    },
  }

  // What the phone shows: mode, speed, altitude; a tap when boost kicks in.
  const wasBoosting = useRef(false)
  useEffect(() => {
    ctrl.send({
      type: 'state',
      mode: phase === 'menu' ? 'menu' : 'playing',
      paused: hud.paused,
      scene: hud.scene,
      speed: hud.speed,
      altitude: hud.altNorm,
      alt: hud.altitude,
    })
    if (phase === 'flying' && hud.boost && !wasBoosting.current) ctrl.send({ type: 'haptic', pattern: 'tap' })
    wasBoosting.current = hud.boost
  }, [hud, phase, ctrl.send, ctrl.phones])

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

  // Enter or Space takes off from the menu, C switches scene, M goes back to the menu, F toggles fullscreen.
  // (The engine handles the flying keys, Shift for boost, and P / Escape for pause.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.code === 'Enter' || e.code === 'Space') && phaseRef.current === 'menu') {
        e.preventDefault()
        start()
      } else if (e.code === 'KeyC') toggleScene()
      else if (e.code === 'KeyF') toggleFullscreen()
      else if (e.code === 'KeyM' && phaseRef.current === 'flying') toMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, toMenu, toggleScene, toggleFullscreen])

  const boostDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    gameRef.current?.setBoost(true)
  }
  const boostUp = () => gameRef.current?.setBoost(false)

  const compass = COMPASS[Math.round(hud.heading / 45) % 8]

  // Rendered into <body>: inside the page the app shell's layers (top bar, tab dock) would draw over the game.
  return createPortal(
    <div className={styles.app} data-scene={hud.scene} ref={appRef}>
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
            {isFullscreen ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
        </button>
      )}

      {phase === 'flying' && (
        <>
          <div className={styles.hud}>
            <Gauge label="SPD" value={hud.speed} unit="km/h" />
            <Gauge label="ALT" value={hud.altitude} unit="m" />
            <Gauge label="HDG" value={`${String(hud.heading).padStart(3, '0')}°`} unit={compass} />
            <Gauge label="FLOWN" value={(hud.distance / 1000).toFixed(1)} unit="km" />
          </div>
          <div className={styles.topbar}>
            <span className={styles.chip}>{SCENE_NAME[hud.scene]}</span>
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
          <button
            type="button"
            className={styles.pauseBtn}
            onClick={() => gameRef.current?.togglePause()}
            aria-label={hud.paused ? 'Resume' : 'Pause'}
          >
            {hud.paused ? '▶' : '❚❚'}
          </button>
          {hud.paused && (
            <div className={styles.overlay}>
              <div className={styles.panel}>
                <h2 className={styles.h2}>Paused</h2>
                <button type="button" className={styles.btn} onClick={() => gameRef.current?.togglePause()}>
                  Resume
                </button>
                <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={toggleScene}>
                  Go to {hud.scene === 'sky' ? SCENE_NAME.space : SCENE_NAME.sky}
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
              Free<span>Fly</span>
            </h1>
            <p className={styles.tag}>No walls. No score. Just fly.</p>
            <div className={styles.scenes} role="group" aria-label="Scene">
              {SCENES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.sceneBtn}
                  aria-pressed={hud.scene === s.id}
                  onClick={() => chooseScene(s.id)}
                >
                  <i className={styles.swatch} data-scene={s.id} />
                  {s.name}
                </button>
              ))}
            </div>
            <button type="button" className={styles.btn} onClick={start}>
              Take off
            </button>
            {!touch && <PhonePanel ctrl={ctrl} gameName="Free Fly" />}
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
  [['A', 'D', '←', '→'], 'Bank and turn'],
  [['W', 'S', '↑', '↓'], 'Climb · dive'],
  [['Shift'], 'Boost'],
  [['C'], 'Switch scene'],
  [['P', 'Esc'], 'Pause'],
  [['M'], 'Back to menu'],
  [['F'], 'Fullscreen'],
  [['Drag'], 'Steer with the mouse'],
]
const TOUCH_ROWS: [keys: string[], action: string][] = [
  [['Drag'], 'Press and drag from the centre to steer'],
  [['Boost'], 'Hold the round button to go fast'],
  [['❚❚'], 'Pause or switch scene'],
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
