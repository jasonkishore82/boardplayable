import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Sky } from '@react-three/drei'
import * as THREE from 'three'
import BowlingMachine, { STUMPS } from './bowler/BowlingMachine.jsx'
import Pitch from './pitch/Pitch.jsx'
import { Outfield, sunDir } from './pitch/PitchScene.jsx'
import { STUMPS_Z } from './pitch/textures.js'
import { BatMesh, HANDLE_Z } from './bat/Bat.jsx'
import { createBatAudio } from './bat/audio.js'
import { GRIP_Y, collideBat, createBatter, stepBatter } from './batter.js'
import { nextDelivery } from './shot'

// Cricket nets: the bowling machine, a full-size pitch and a net tunnel, and a bat in your hands.
//
// The world is the bowling machine's own frame (it bowls along +x and its physics, stumps and nets are fixed there),
// so the pitch is turned to run along x with the batter's stumps at x = 12.5, where the machine aims.
//
// The bat is moved by the player's input (`input.current`: x and y in -1..1, from a phone's tilt or the mouse) through
// batter.js, stepped inside the machine's own 600 Hz physics loop (onStep), so a fast swing sweeps through the ball
// instead of jumping past it.

const PITCH_X = STUMPS.x - STUMPS_Z // where the middle of the pitch sits along x
const VIEWS = {
  batter: { pos: [13.75, 1.42, 0.78], look: [2, 0.55, -0.15], fov: 42 },
  side: { pos: [9.3, 1.35, 2.3], look: [10.9, 0.5, 0], fov: 44 },
  // the keeper's eye line: just inside the back net, low, straight down the pitch over the stumps and the bat
  stumps: { pos: [13.75, 0.95, 0], look: [0, 0.6, 0], fov: 40 },
  machine: { pos: [-2.4, 1.9, 0.5], look: [11.5, 0.45, 0], fov: 36 },
}

// one shared net texture: a diamond mesh of dark cord
function useNetTexture(repeatX, repeatY) {
  const t = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 })
    const g = c.getContext('2d')
    g.strokeStyle = '#141414'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(128, 128)
    g.moveTo(128, 0)
    g.lineTo(0, 128)
    g.stroke()
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    tex.anisotropy = 8
    return tex
  }, [repeatX, repeatY])
  useEffect(() => () => t.dispose(), [t])
  return t
}

// The net tunnel the machine's physics already knows about: sides at z = ±2.6, the back behind the stumps at x = 14,
// and behind the machine at x = -3.
function Nets() {
  const side = useNetTexture(110, 20)
  const end = useNetTexture(34, 20)
  const H = 3.2
  const mat = (map) => <meshStandardMaterial map={map} transparent alphaTest={0.3} color="#202020" side={THREE.DoubleSide} />
  return (
    <group>
      {[-2.6, 2.6].map((z) => (
        <mesh key={z} position={[5.5, H / 2, z]}>
          <planeGeometry args={[17, H]} />
          {mat(side)}
        </mesh>
      ))}
      {[14, -3].map((x) => (
        <mesh key={x} position={[x, H / 2, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[5.2, H]} />
          {mat(end)}
        </mesh>
      ))}
      {[-3, 2.6, 8.3, 14].flatMap((x) =>
        [-2.6, 2.6].map((z) => (
          <mesh key={`${x}${z}`} position={[x, H / 2, z]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, H, 12]} />
            <meshStandardMaterial color="#2b2c2f" metalness={0.6} roughness={0.4} />
          </mesh>
        )),
      )}
    </group>
  )
}

function Light() {
  const dir = useMemo(() => sunDir(38), [])
  return (
    <>
      <Sky sunPosition={dir.clone().multiplyScalar(100).toArray()} turbidity={6} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.86} />
      <fog attach="fog" args={['#c3d0d9', 45, 240]} />
      <hemisphereLight args={['#cfe0f0', '#77735e', 0.3]} />
      <directionalLight
        position={dir.clone().multiplyScalar(40).toArray()}
        intensity={2.8}
        color="#fff4e4"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.012}
      >
        <orthographicCamera attach="shadow-camera" args={[-17, 17, 17, -17, 1, 90]} />
      </directionalLight>
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#8fa7bd']} />
        <Lightformer form="rect" intensity={1.6} color="#dfe9f5" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff1df" position={[-8, 4, -6]} rotation-y={Math.PI / 4} scale={[6, 5, 1]} />
        <Lightformer form="rect" intensity={0.22} color="#8c9078" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>
    </>
  )
}

// Moves the camera between the views, easing over half a second.
function CameraRig({ view }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(...VIEWS.batter.look))
  const first = useRef(true)
  useFrame((_, dt) => {
    const v = VIEWS[view] || VIEWS.batter
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 6)
    first.current = false
    camera.position.lerp(new THREE.Vector3(...v.pos), k)
    look.current.lerp(new THREE.Vector3(...v.look), k)
    camera.fov += (v.fov - camera.fov) * k
    camera.updateProjectionMatrix()
    camera.lookAt(look.current)
  })
  return null
}

function Scene({ view, pace, bowl, input, sound, onDelivery, onContact, onReport, onLaunch }) {
  const bat = useMemo(() => createBatter(), [])
  const batRef = useRef()
  const [settings, setSettings] = useState(() => nextDelivery(pace))
  const [feed, setFeed] = useState(0)
  const cb = useRef({})
  cb.current = { onDelivery, onContact, onLaunch, sound }

  // A new ball: set the machine for it, give the head a moment to swing round to the new line and length, then let
  // one go from the hopper.
  useEffect(() => {
    if (!bowl) return undefined
    setSettings(nextDelivery(pace))
    const t = setTimeout(() => setFeed((f) => f + 1), 750)
    return () => clearTimeout(t)
  }, [bowl]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setSettings((s) => ({ ...s, ...nextDelivery(pace) })), [pace])

  // ---- sound: the crack off the bat ----
  const audio = useRef(null)
  useEffect(() => () => audio.current?.dispose(), [])
  const crack = (s) => {
    if (!cb.current.sound) return
    if (!audio.current) audio.current = createBatAudio()
    audio.current?.crack(s)
  }

  // ---- the ball being bowled now ----
  const ball = useRef(null) // { body, t, hit, lastHit, exit, done }
  const finish = (d, result) => {
    if (d.done) return
    d.done = true
    cb.current.onDelivery?.(result)
  }

  const onEvent = (type, body) => {
    if (type === 'launch') {
      ball.current = { body, t: 0, hit: false, lastHit: 0, exit: null, done: false }
      cb.current.onLaunch?.()
    } else if (type === 'stumps') {
      const d = ball.current
      if (d && d.body === body && !d.done) finish(d, { kind: d.hit ? 'played-on' : 'bowled' })
    }
  }

  // ---- 600 Hz: move the bat, then follow the ball ----
  const onStep = (h) => {
    const inp = input.current
    // Space bar: a scripted drive, lift and then through the line
    let y = inp.y
    if (inp.auto) {
      const since = (performance.now() - inp.auto) / 1000
      if (since < 0.2) y = 1
      else if (since < 0.5) y = -1
      else inp.auto = 0
    }
    stepBatter(bat, { x: inp.x, y, q: inp.auto ? null : inp.q, hands: inp.hands }, h)

    const d = ball.current
    if (!d || d.done) return
    d.t += h
    if (d.hit) {
      // it has left the bat for good once nothing has touched it for a moment
      if (d.t - d.lastHit > 0.12) finish(d, { kind: 'hit', ...d.exit })
    } else if (d.body.p.x > STUMPS.x + 0.25 || d.t > 3.5) finish(d, { kind: 'missed' })
  }

  const onBallStep = (body, h) => {
    const speed = collideBat(bat, body, h)
    if (!speed) return
    if (speed > 1) crack(speed / 25)
    const d = ball.current
    if (d && d.body === body && !d.done) {
      if (!d.hit) cb.current.onContact?.(speed)
      d.hit = true
      d.lastHit = d.t
      d.exit = { vx: body.v.x, vy: body.v.y, vz: body.v.z, y: body.p.y }
    }
  }

  useFrame(() => {
    if (!batRef.current) return
    batRef.current.position.copy(bat.pos)
    batRef.current.quaternion.copy(bat.quat)
  })

  return (
    <>
      <Light />
      <group position={[PITCH_X, 0, 0]} rotation-y={Math.PI / 2}>
        <Pitch wear={0.35} grass={0.62} />
        <Outfield />
      </group>
      <Nets />
      <BowlingMachine
        ball="cricket"
        speed={settings.speed}
        elevation={settings.elevation}
        line={settings.line}
        delivery={settings.delivery}
        autoFeed={false}
        sound={sound}
        feed={feed}
        onReport={onReport}
        onStep={onStep}
        onBallStep={onBallStep}
        onEvent={onEvent}
      />
      <group ref={batRef}>
        <BatMesh />
        {/* batting gloves on the handle */}
        {[GRIP_Y + 0.005, GRIP_Y - 0.085].map((y, i) => (
          <mesh key={i} position={[0, y, HANDLE_Z]} castShadow>
            <capsuleGeometry args={[0.034, 0.05, 6, 16]} />
            <meshStandardMaterial color={i ? '#f4f4f2' : '#1f4fa0'} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <CameraRig view={view} />
    </>
  )
}

/**
 * The nets, ready to drop into a page. Props:
 *   view      'batter' | 'side' | 'stumps' | 'machine'
 *   pace      'medium' | 'fast' | 'express'
 *   bowl      bump to bowl the next ball
 *   input     a ref holding { x, y, auto }: the bat's controls (auto: a timestamp that starts a scripted swing)
 *   sound     crack, motor and bounce sounds
 *   onLaunch, onContact(speed), onDelivery(result), onReport({ kmh })
 */
export default function NetsScene(props) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: VIEWS.batter.pos, fov: VIEWS.batter.fov, near: 0.03, far: 600 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
      <Scene {...props} />
    </Canvas>
  )
}
