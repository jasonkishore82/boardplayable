import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Court, { ShuttleModel, shuttleMaterials } from './badmintoncourt/Court.jsx'
import { Floor, Hall, KeyLight } from './badmintoncourt/CourtScene.jsx'
import { COURT, MAT_T } from './badmintoncourt/textures.js'
import { step } from './game/match'
import { yourShot } from './game/play'
import { createBadmintonAudio } from './audio.js'

// The arena: the BWF court in its sports hall, two players with rackets, and the shuttle. It runs the match (see
// game/match.ts) a frame at a time and shows it; the page reads the events (hits, points) it hands back.
//
// The racket is a simple regulation-size stand-in drawn here (230 x 290 mm head, 675 mm long) until the racket model
// files are added.

const UP = new THREE.Vector3(0, 1, 0)
const BG = '#1b1c1f'

// ---------- the racket ----------
function stringTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
  const g = c.getContext('2d')
  g.clearRect(0, 0, 256, 256)
  g.strokeStyle = 'rgba(245,245,240,0.95)'
  g.lineWidth = 1.6
  for (let i = 0; i <= 22; i++) {
    const x = (i / 22) * 256
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, 256)
    g.stroke()
  }
  for (let i = 0; i <= 24; i++) {
    const y = (i / 24) * 256
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(256, y)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

function useRacketParts() {
  const parts = useMemo(() => {
    const strings = stringTexture()
    return {
      strings,
      geo: {
        frame: new THREE.TorusGeometry(1, 0.06, 8, 48),
        bed: new THREE.CircleGeometry(1, 40),
        shaft: new THREE.CylinderGeometry(0.0035, 0.0045, 0.27, 10),
        handle: new THREE.CylinderGeometry(0.013, 0.012, 0.2, 8),
        cap: new THREE.CylinderGeometry(0.014, 0.014, 0.01, 8),
      },
      mats: {
        frame: new THREE.MeshPhysicalMaterial({ color: '#141a2e', roughness: 0.3, clearcoat: 1, metalness: 0.2 }),
        shaft: new THREE.MeshPhysicalMaterial({ color: '#d9dde6', roughness: 0.25, metalness: 0.6 }),
        grip: new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.9 }),
        bed: new THREE.MeshBasicMaterial({ map: strings, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      },
    }
  }, [])
  useEffect(
    () => () => {
      parts.strings.dispose()
      Object.values(parts.geo).forEach((g) => g.dispose())
      Object.values(parts.mats).forEach((m) => m.dispose())
    },
    [parts],
  )
  return parts
}

/** A racket in its own frame: the butt of the handle at the origin, the head up +y, the string bed in the x-y plane. */
function Racket({ parts, accent }) {
  const { geo, mats } = parts
  const frame = useMemo(() => mats.frame.clone(), [mats])
  useEffect(() => {
    frame.color.set(accent)
    return () => frame.dispose()
  }, [frame, accent])
  return (
    <group>
      <mesh geometry={geo.handle} material={mats.grip} position-y={0.1} castShadow />
      <mesh geometry={geo.cap} material={frame} position-y={0.004} />
      <mesh geometry={geo.shaft} material={mats.shaft} position-y={0.2 + 0.135} castShadow />
      <group position-y={0.47 + 0.145}>
        <mesh geometry={geo.frame} material={frame} scale={[0.115, 0.145, 0.115]} castShadow />
        <mesh geometry={geo.bed} material={mats.bed} scale={[0.112, 0.142, 1]} />
      </group>
    </group>
  )
}

// ---------- a player ----------
function Player({ player, side, colors, racket }) {
  const root = useRef()
  const arm = useRef()
  const legs = useRef([])
  const last = useRef({ x: player.x, z: player.z })
  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    g.position.set(player.x, MAT_T, player.z)
    // a skip in the stride while moving
    const moved = Math.hypot(player.x - last.current.x, player.z - last.current.z)
    last.current = { x: player.x, z: player.z }
    const running = moved / Math.max(dt, 1e-3) > 0.4
    const t = performance.now() / 1000
    legs.current.forEach((l, i) => l && (l.rotation.x = running ? Math.sin(t * 14 + i * Math.PI) * 0.6 : 0))
    // the swing: the racket arm goes up and back, then whips over and through
    const s = player.swing
    let a
    if (s < 0.08) a = -2.4 - (s / 0.08) * 0.4
    else if (s < 0.3) a = -2.8 + ((s - 0.08) / 0.22) * 3.6
    else if (s < 0.7) a = 0.8 - ((s - 0.3) / 0.4) * 2.1
    else a = -1.3
    arm.current.rotation.x = a
  })
  return (
    <group ref={root} rotation-y={side === 0 ? Math.PI / 2 : -Math.PI / 2}>
      {/* legs */}
      {[-0.11, 0.11].map((x, i) => (
        <group key={x} ref={(l) => (legs.current[i] = l)} position={[x, 0.85, 0]}>
          <mesh position-y={-0.42} castShadow>
            <capsuleGeometry args={[0.07, 0.7, 4, 10]} />
            <meshStandardMaterial color={colors.shorts} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* body and head */}
      <mesh position-y={1.22} castShadow>
        <capsuleGeometry args={[0.19, 0.45, 6, 14]} />
        <meshStandardMaterial color={colors.shirt} roughness={0.7} />
      </mesh>
      <mesh position-y={1.72} castShadow>
        <sphereGeometry args={[0.12, 20, 14]} />
        <meshStandardMaterial color={colors.skin} roughness={0.6} />
      </mesh>
      {/* the off arm */}
      <mesh position={[-0.26, 1.25, 0.05]} rotation-x={-0.4} castShadow>
        <capsuleGeometry args={[0.05, 0.45, 4, 8]} />
        <meshStandardMaterial color={colors.skin} roughness={0.6} />
      </mesh>
      {/* the racket arm: from the shoulder, the racket in the hand */}
      <group ref={arm} position={[0.26, 1.5, 0]}>
        <mesh position-y={0.28} castShadow>
          <capsuleGeometry args={[0.05, 0.45, 4, 8]} />
          <meshStandardMaterial color={colors.skin} roughness={0.6} />
        </mesh>
        <group position-y={0.5} rotation-x={0.2}>
          <Racket parts={racket} accent={colors.racket} />
        </group>
      </group>
    </group>
  )
}

// ---------- the shuttle ----------
function FlyingShuttle({ match }) {
  const mats = useMemo(() => shuttleMaterials(), [])
  useEffect(() => () => mats.dispose(), [mats])
  const ref = useRef()
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const m = match.current
    const g = ref.current
    if (!m || !g) return
    const s = m.shuttle
    g.position.set(s.p.x, Math.max(MAT_T + 0.012, s.p.y), s.p.z)
    v.set(s.v.x, s.v.y, s.v.z)
    if (s.landed) {
      // on its side on the mat
      q.setFromEuler(new THREE.Euler(0, 0, -1.25))
    } else if (v.lengthSq() > 0.25) {
      // the cork leads: the skirt (+y) points back along the flight
      q.setFromUnitVectors(UP, v.normalize().negate())
    } else q.identity() // in the hand: cork down, skirt up
    g.quaternion.slerp(q, s.landed ? 0.3 : 0.6)
  })
  return (
    <group ref={ref} scale={1.6}>
      <ShuttleModel mats={mats} />
    </group>
  )
}

// where your shot is going: a ring on their court, and where the last shuttle came down
function Markers({ match, aimVisible }) {
  const aim = useRef()
  const land = useRef()
  useFrame(() => {
    const m = match.current
    if (!m) return
    const showAim = aimVisible.current && m.phase !== 'point' && m.phase !== 'over' && (m.lastHitter === 1 || (m.phase === 'serve' && m.score.server === 0))
    aim.current.visible = showAim
    if (showAim) {
      const plan = yourShot(0, m.aim, 0.6, 1.8)
      aim.current.position.set(plan.to.x, MAT_T + 0.004, plan.to.z)
    }
    land.current.visible = m.phase === 'point' && m.shuttle.landed
    if (land.current.visible) land.current.position.set(m.shuttle.p.x, MAT_T + 0.004, m.shuttle.p.z)
  })
  return (
    <>
      <mesh ref={aim} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.22, 0.3, 40]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={land} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.16, 32]} />
        <meshBasicMaterial color="#ff4d5e" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </>
  )
}

// behind you, high enough to see the whole far court, drifting with you across the court
function CameraRig({ match }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(1.5, 0.6, 0))
  const first = useRef(true)
  useFrame((_, dt) => {
    const m = match.current
    if (!m) return
    const z = m.players[0].z
    const pos = new THREE.Vector3(-COURT.L2 - 3.6, 4.1, z * 0.35)
    const tgt = new THREE.Vector3(1.8, 0.5, z * 0.2)
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 3)
    first.current = false
    camera.position.lerp(pos, k)
    look.current.lerp(tgt, k)
    camera.lookAt(look.current)
  })
  return null
}

function World({ match, onEvents, sound, aimVisible, paused }) {
  const racket = useRacketParts()
  const audio = useRef(null)
  const live = useRef({})
  live.current = { onEvents, sound, paused }
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, s) => {
    if (!live.current.sound) return
    if (!audio.current) audio.current = createBadmintonAudio()
    audio.current?.[name](s)
  }
  const netted = useRef(false)
  useFrame((_, delta) => {
    const m = match.current
    if (!m || live.current.paused) return
    step(m, Math.min(delta, 1 / 20))
    if (m.shuttle.netted && !netted.current) play('net')
    netted.current = m.shuttle.netted
    if (m.events.length) {
      for (const e of m.events) {
        if (e.type === 'hit') play('hit', e.speed / 60)
        else if (e.type === 'whiff') play('whoosh')
        else if (e.type === 'point') play('land')
      }
      live.current.onEvents?.(m.events.slice())
      m.events.length = 0
    }
  })
  const m = match.current
  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 28, 60]} />
      <Floor dark />
      <hemisphereLight args={['#ffffff', '#6b5a48', 0.25]} />
      <KeyLight />
      <Hall brightness={1} />
      <Court shuttles={false} wear={0.35} />
      {m && (
        <>
          <Player player={m.players[0]} side={0} racket={racket} colors={{ shirt: '#e8423f', shorts: '#1d2333', skin: '#c99a76', racket: '#e8423f' }} />
          <Player player={m.players[1]} side={1} racket={racket} colors={{ shirt: '#2f6fd0', shorts: '#f2f2ee', skin: '#8d5b3d', racket: '#141a2e' }} />
        </>
      )}
      <FlyingShuttle match={match} />
      <Markers match={match} aimVisible={aimVisible} />
      <CameraRig match={match} />
    </>
  )
}

/**
 * The arena. Props:
 *   match       a ref holding the match (game/match.ts); the arena steps it every frame
 *   onEvents    called with the events (hits, points, the end) after each frame that has any
 *   aimVisible  a ref: show the ring where your shot will land
 *   paused, sound
 */
export default function Arena(props) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [-10, 4, 0], fov: 46, near: 0.05, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
      <World {...props} />
    </Canvas>
  )
}
