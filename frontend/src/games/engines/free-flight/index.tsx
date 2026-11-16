import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhonePanel } from '../../controller/PhonePanel'
import { usePhoneController, type ControllerHandlers } from '../../controller/usePhoneController'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import { Game, type FlightHud } from './engine/Game'
import { WORLDS } from './engine/worlds'
import styles from './FreeFlight.module.css'

// Free Flight: a single-player flying sandbox, no score and no crashing. It fills the window over the app.
// The engine (engine/) is the plain three.js game from gyro_games/free-flight; this file is its screen: the menu,
// the gauges and the pause card. It is flown with the keyboard, by dragging, or with a phone: the menu shows a QR
// code when the dev server's controller relay is running (usePhoneController).

const CAM_LABEL: Record<FlightHud['camera'], string> = { chase: 'Chase', far: 'Wide', cockpit: 'Cockpit' }
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export default function FreeFlight(_: GameEngineProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [phase, setPhase] = useState<'menu' | 'flying'>('menu')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [hud, setHud] = useState<FlightHud>({
    speed: 0,
    altitude: null,
    heading: 0,
    world: WORLDS[0].name,
    worldId: WORLDS[0].id,
    camera: 'chase',
    paused: false,
  })

  useEffect(() => {
    const game = new Game(mountRef.current!, { onHud: setHud })
    gameRef.current = game
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [])

  // ---- phone controller (QR code on the menu); same messages as the stand-alone version ----
  const phoneHandlers = useRef<ControllerHandlers>({})
  const ctrl = usePhoneController('free-flight', phoneHandlers)
  const sendRef = useRef(ctrl.send)
  sendRef.current = ctrl.send

  const start = useCallback(() => {
    gameRef.current?.start()
    setPhase('flying')
    sendRef.current({ type: 'calibrate' })
  }, [])

  const toMenu = useCallback(() => {
    gameRef.current?.toMenu()
    setPhase('menu')
  }, [])

  phoneHandlers.current = {
    onTilt: (x, y) => gameRef.current?.setRemoteInput(x, y),
    onAction: (action) => {
      const g = gameRef.current
      if (!g) return
      if (action === 'primary') {
        if (phaseRef.current === 'menu') start()
        else g.togglePause()
      } else if (action === 'menu') toMenu()
      else if (action === 'scene') g.nextWorld()
      else if (action === 'view') g.cycleCamera()
      else if (action === 'respawn') g.respawn()
      else if (action === 'boost-on') g.setRemoteButton('boost', true)
      else if (action === 'boost-off') g.setRemoteButton('boost', false)
      else if (action === 'brake-on') g.setRemoteButton('brake', true)
      else if (action === 'brake-off') g.setRemoteButton('brake', false)
    },
  }

  useEffect(() => {
    ctrl.send({
      type: 'state',
      mode: phase,
      paused: hud.paused,
      speed: hud.speed,
      altitude: hud.altitude,
      altNorm: hud.altNorm ?? 0.5,
      world: hud.world,
      camera: CAM_LABEL[hud.camera] || hud.camera,
    })
  }, [hud, phase, ctrl.send, ctrl.phones])

  // a little buzz on the phone when the scene changes
  const lastWorld = useRef(hud.worldId)
  useEffect(() => {
    if (lastWorld.current !== hud.worldId) ctrl.send({ type: 'haptic', pattern: 'double' })
    lastWorld.current = hud.worldId
  }, [hud.worldId, ctrl.send])

  // Browser fullscreen for the whole game (canvas and gauges), toggled with F or the corner button.
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

  // Enter or Space takes off from the menu, M goes back to it, Escape pauses, F toggles fullscreen.
  // (The engine handles the flying keys.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'Space') && phaseRef.current === 'menu') {
        e.preventDefault()
        start()
      } else if (e.code === 'KeyM' && phaseRef.current === 'flying') toMenu()
      else if (e.code === 'Escape' && phaseRef.current === 'flying') gameRef.current?.togglePause()
      else if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, toMenu, toggleFullscreen])

  const compass = COMPASS[Math.round(hud.heading / 45) % 8]

  return (
    <div className={styles.app} data-world={hud.worldId} ref={appRef}>
      <div className={styles.stage} ref={mountRef} />
      <div className={styles.vignette} />
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
          </div>
          <div className={styles.topbar}>
            <span className={styles.chip}>{hud.world}</span>
            <span className={styles.chip}>{CAM_LABEL[hud.camera]} cam</span>
            {hud.boosting && <span className={[styles.chip, styles.boost].join(' ')}>Boost</span>}
          </div>
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
                <button type="button" className={[styles.btn, styles.ghost].join(' ')} onClick={() => gameRef.current?.nextWorld()}>
                  Switch scene
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
            <div className={styles.worlds} role="group" aria-label="Scene">
              {WORLDS.map((w, i) => (
                <button
                  key={w.id}
                  type="button"
                  className={styles.worldBtn}
                  aria-pressed={hud.worldId === w.id}
                  onClick={() => gameRef.current?.setWorld(i)}
                >
                  <i className={styles.swatch} data-world={w.id} />
                  {w.name}
                </button>
              ))}
            </div>
            <button type="button" className={styles.btn} onClick={start}>
              Take off
            </button>
            <PhonePanel ctrl={ctrl} gameName="Free Flight" />
            <div className={styles.help}>
              <div>
                <kbd>W</kbd>
                <kbd>S</kbd> / <kbd>↑</kbd>
                <kbd>↓</kbd> climb · dive &nbsp; <kbd>A</kbd>
                <kbd>D</kbd> / <kbd>←</kbd>
                <kbd>→</kbd> turn
              </div>
              <div>
                <kbd>Q</kbd>
                <kbd>E</kbd> roll · <kbd>Shift</kbd> boost · <kbd>Space</kbd> brake
              </div>
              <div>
                <kbd>C</kbd> camera · <kbd>N</kbd> scene · <kbd>R</kbd> respawn · <kbd>P</kbd> pause · drag to steer
              </div>
            </div>
          </div>
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
