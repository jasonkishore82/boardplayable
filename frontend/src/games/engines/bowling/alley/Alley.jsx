import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { BALL_STYLES, HOLES, PIN_FINISHES, ballMaps, holeCut, laneTexture, pinMaps } from '../pin/BowlingPin.jsx'
import { createPinAudio } from '../pin/audio.js'
import { BALL_R, PIN_COM, PIN_H, profile } from '../pin/shape.js'
import { FOUL_Z, GUTTER_R, LANE_W, OIL_END_Z, PIT_DEPTH, PIT_Z, bowl, createLane, settled, standing, stepLane, sweep } from './lane.js'
import { TV_H, TV_W, drawTV } from './tv.js'

// The alley: four full-size lanes side by side, each with its own rack, ball, gutters, kickbacks and pit, a masking
// unit over the pins with the lane number, and a TV hung over the lane showing that lane's scorecard.
//
// World frame: the lanes run along z like lane.js (headpins at z = 0, foul lines at z = 18.29), side by side along x.
// Each lane's physics is in its own frame, so a lane is drawn inside a group moved along x.
//
// The page drives it through a ref: bowl(lane, throw), and gets onSettled(lane, standing) back once the ball has gone
// and the pins have stopped, then calls sweep(lane, freshRack). aim.current says where the bowler on the active lane
// is standing and aiming, so the ball and an aiming line can be drawn there before the throw.

export const LANES = 4
const SPACING = 2.0
export const laneX = (i) => (i - (LANES - 1) / 2) * SPACING
const SUB = 1 / 1500
const LANE_LEN = FOUL_Z - PIT_Z
// hung 1.5 m down the lane from the foul line, so it sits in the top of the bowler's view while they aim
const TV = { y: 2.35, z: FOUL_Z - 1.5, w: 1.5, tilt: 0.12 }
const CEILING = 3.4
const BALL_COLOURS = ['sapphire', 'ruby', 'emerald', 'cosmic']

// ---------- shared pieces ----------
function useParts() {
  const parts = useMemo(() => {
    const pin = new THREE.LatheGeometry(profile(120), 40)
    const p = pin.attributes.position
    const uv = pin.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / PIN_H)
    pin.computeVertexNormals()
    const holes = HOLES.map((h) => ({
      bore: new THREE.CylinderGeometry(h.a, h.a, h.depth, 24, 1, true),
      floor: new THREE.CircleGeometry(h.a, 24).rotateX(-Math.PI / 2),
      lip: new THREE.TorusGeometry(h.a + h.lip, h.lip, 10, 40).rotateX(Math.PI / 2),
    }))
    const maple = laneTexture()
    maple.repeat.set(1, 10)
    const approach = laneTexture()
    approach.repeat.set(1, 2.4)
    const coat = pinMaps(PIN_FINISHES.classic, 0.2)
    return {
      geo: { pin, ball: new THREE.SphereGeometry(BALL_R, 64, 48), holes },
      maple,
      approach,
      coat,
      mats: {
        lane: new THREE.MeshPhysicalMaterial({ map: maple, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }),
        approach: new THREE.MeshPhysicalMaterial({ map: approach, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2, color: '#f2e6d4' }),
        pin: new THREE.MeshPhysicalMaterial({ map: coat.map, roughnessMap: coat.rough, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.04 }),
        bore: new THREE.MeshStandardMaterial({ color: '#0a0c14', roughness: 0.7, side: THREE.BackSide }),
        boreFloor: new THREE.MeshStandardMaterial({ color: '#030308', roughness: 0.9 }),
        gutter: new THREE.MeshStandardMaterial({ color: '#2a2b2e', metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }),
        kick: new THREE.MeshStandardMaterial({ color: '#16131a', roughness: 0.6 }),
        pit: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 1 }),
        foul: new THREE.MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.5 }),
        arrow: new THREE.MeshStandardMaterial({ color: '#2d1a0e', roughness: 0.4 }),
        divider: new THREE.MeshStandardMaterial({ color: '#232036', roughness: 0.5 }),
        carpet: new THREE.MeshStandardMaterial({ color: '#1d1636', roughness: 1 }),
        ceiling: new THREE.MeshStandardMaterial({ color: '#0b0a12', roughness: 1 }),
        light: new THREE.MeshBasicMaterial({ color: '#fff6e6' }),
        masking: new THREE.MeshStandardMaterial({ color: '#181433', roughness: 0.7 }),
        neon: new THREE.MeshBasicMaterial({ color: '#ff3fa4' }),
        neon2: new THREE.MeshBasicMaterial({ color: '#3ad6ff' }),
        tvCase: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.4, metalness: 0.4 }),
        rod: new THREE.MeshStandardMaterial({ color: '#3a3b40', metalness: 0.8, roughness: 0.3 }),
        hood: new THREE.MeshPhysicalMaterial({ color: '#2a2f6b', roughness: 0.3, clearcoat: 1 }),
        aim: new THREE.MeshBasicMaterial({ color: '#ffcf3a', transparent: true, opacity: 0.55, depthWrite: false }),
      },
      balls: BALL_COLOURS.map((name) => {
        const cols = BALL_STYLES[name]
        const map = ballMaps(cols)
        return {
          map,
          ball: holeCut(new THREE.MeshPhysicalMaterial({ map, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 })),
          lip: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(cols[1]).lerp(new THREE.Color(cols[2]), 0.35), roughness: 0.2, clearcoat: 1 }),
        }
      }),
    }
  }, [])
  useEffect(
    () => () => {
      parts.geo.pin.dispose()
      parts.geo.ball.dispose()
      parts.geo.holes.forEach((h) => Object.values(h).forEach((g) => g.dispose()))
      parts.maple.dispose()
      parts.approach.dispose()
      parts.coat.map.dispose()
      parts.coat.rough.dispose()
      Object.values(parts.mats).forEach((m) => m.dispose())
      parts.balls.forEach((b) => (b.map.dispose(), b.ball.dispose(), b.lip.dispose()))
    },
    [parts],
  )
  return parts
}

// a lane number for the masking unit over the pins
function numberTexture(n) {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 256 })
  const g = c.getContext('2d')
  g.fillStyle = '#181433'
  g.fillRect(0, 0, 512, 256)
  const grd = g.createLinearGradient(0, 0, 512, 0)
  grd.addColorStop(0, '#ff3fa4')
  grd.addColorStop(1, '#3ad6ff')
  g.fillStyle = grd
  g.font = '900 170px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(n), 256, 136)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- one lane ----------
function Lane({ index, lane, parts, aim, tv, active }) {
  const pinRefs = useRef([])
  const ballRef = useRef()
  const aimRef = useRef()
  const { geo, mats } = parts
  const ballMats = parts.balls[index % parts.balls.length]

  // the TV's screen
  const screen = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: TV_W, height: TV_H })
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return { c, t }
  }, [])
  const num = useMemo(() => numberTexture(index + 1), [index])
  useEffect(() => () => (screen.t.dispose(), num.dispose()), [screen, num])
  useEffect(() => {
    drawTV(screen.c.getContext('2d'), tv)
    screen.t.needsUpdate = true
  }, [tv, screen])

  useFrame(() => {
    lane.pins.forEach((p, i) => {
      const g = pinRefs.current[i]
      if (!g) return
      g.visible = !p.removed
      g.position.copy(p.pos)
      g.quaternion.copy(p.quat)
    })
    const b = lane.ball
    const a = aim.current
    const showAim = active && !lane.rolling && a.visible
    if (lane.rolling || b.active) {
      ballRef.current.visible = b.pos.y > -0.5
      ballRef.current.position.copy(b.pos)
      ballRef.current.quaternion.copy(b.quat)
    } else if (showAim) {
      // held at the foul line, finger holes up, ready to go
      ballRef.current.visible = true
      ballRef.current.position.set(a.x, BALL_R, FOUL_Z - 0.3)
      ballRef.current.quaternion.setFromEuler(new THREE.Euler(-0.9, 0, 0))
    } else ballRef.current.visible = false
    aimRef.current.visible = showAim
    if (showAim) {
      aimRef.current.position.set(a.x, 0.003, FOUL_Z - 0.3)
      aimRef.current.rotation.set(0, -a.angle, 0)
    }
  })

  const midZ = (FOUL_Z + PIT_Z) / 2
  return (
    <group position={[laneX(index), 0, 0]}>
      {/* the lane: oiled maple from the pin deck to the foul line */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, midZ]} material={mats.lane} receiveShadow>
        <planeGeometry args={[LANE_W, LANE_LEN]} />
      </mesh>
      {/* targeting arrows, 15 ft past the foul line, and the dots before them */}
      {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
        <mesh key={k} rotation-x={-Math.PI / 2} position={[k * 0.135, 0.0015, FOUL_Z - 4.57 - Math.abs(k) * 0.3]} material={mats.arrow}>
          <circleGeometry args={[0.03, 3]} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0015, FOUL_Z]} material={mats.foul}>
        <planeGeometry args={[LANE_W + 2 * GUTTER_R * 2, 0.02]} />
      </mesh>
      {/* the approach behind the foul line */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, FOUL_Z + 2.5]} material={mats.approach} receiveShadow>
        <planeGeometry args={[SPACING, 5]} />
      </mesh>
      {/* gutters and capping */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (LANE_W / 2 + GUTTER_R), 0, midZ]} rotation={[Math.PI / 2, 0, 0]} material={mats.gutter} receiveShadow>
            <cylinderGeometry args={[GUTTER_R, GUTTER_R, LANE_LEN, 20, 1, true, -Math.PI / 2, Math.PI]} />
          </mesh>
          <mesh position={[s * (SPACING / 2 - (SPACING / 2 - LANE_W / 2 - 2 * GUTTER_R) / 2), 0.02, midZ]} material={mats.divider} receiveShadow>
            <boxGeometry args={[SPACING / 2 - LANE_W / 2 - 2 * GUTTER_R, 0.04, LANE_LEN]} />
          </mesh>
          {/* kickbacks */}
          <mesh position={[s * 0.88, 0.32, -0.3]} material={mats.kick} castShadow receiveShadow>
            <boxGeometry args={[0.04, 0.64, 2.4]} />
          </mesh>
        </group>
      ))}
      {/* the pit and its curtain */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -PIT_DEPTH, (PIT_Z - 1.55) / 2]} material={mats.pit}>
        <planeGeometry args={[1.8, 1.55 + PIT_Z]} />
      </mesh>
      <mesh position={[0, -PIT_DEPTH / 2, PIT_Z]} rotation-y={Math.PI} material={mats.kick}>
        <planeGeometry args={[1.72, PIT_DEPTH]} />
      </mesh>
      <mesh position={[0, 0.5 - PIT_DEPTH / 2, -1.52]} material={mats.pit}>
        <planeGeometry args={[1.8, 1.0 + PIT_DEPTH]} />
      </mesh>
      {/* the masking unit over the pinsetter, with the lane number */}
      <mesh position={[0, 1.15, -0.95]} material={mats.masking}>
        <boxGeometry args={[SPACING, 0.9, 0.12]} />
      </mesh>
      <mesh position={[0, 1.15, -0.885]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshBasicMaterial map={num} toneMapped={false} />
      </mesh>

      {/* the TV, hung from the ceiling just past the foul line, tipped down to the bowler */}
      <group position={[0, TV.y, TV.z]} rotation-x={-TV.tilt}>
        <mesh material={mats.tvCase} castShadow>
          <boxGeometry args={[TV.w + 0.08, (TV.w * TV_H) / TV_W + 0.08, 0.07]} />
        </mesh>
        <mesh position={[0, 0, 0.036]}>
          <planeGeometry args={[TV.w, (TV.w * TV_H) / TV_W]} />
          <meshBasicMaterial map={screen.t} toneMapped={false} />
        </mesh>
      </group>
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, (TV.y + CEILING) / 2 + 0.1, TV.z - 0.05]} material={mats.rod}>
          <cylinderGeometry args={[0.012, 0.012, CEILING - TV.y, 8]} />
        </mesh>
      ))}

      {/* the pins and the ball */}
      {lane.pins.map((_, i) => (
        <group key={i} ref={(g) => (pinRefs.current[i] = g)}>
          <mesh geometry={geo.pin} material={mats.pin} position={[0, -PIN_COM, 0]} castShadow receiveShadow />
        </group>
      ))}
      <group ref={ballRef}>
        <mesh geometry={geo.ball} material={ballMats.ball} castShadow />
        {HOLES.map((h, i) => (
          <group key={i} quaternion={h.q}>
            <mesh geometry={geo.holes[i].bore} material={mats.bore} position-y={h.mouth - h.depth / 2} />
            <mesh geometry={geo.holes[i].floor} material={mats.boreFloor} position-y={h.mouth - h.depth} />
            <mesh geometry={geo.holes[i].lip} material={ballMats.lip} position-y={Math.sqrt(BALL_R * BALL_R - (h.a + h.lip) ** 2) - h.lip * 0.35} />
          </group>
        ))}
      </group>
      {/* the aiming line: where the ball is headed, out past the arrows */}
      <group ref={aimRef}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, -3.2]} material={mats.aim}>
          <planeGeometry args={[0.03, 6.2]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- the house around the lanes ----------
function House({ parts }) {
  const { mats } = parts
  const width = LANES * SPACING + 2
  return (
    <group>
      {/* carpet behind the approaches, and the floor under everything */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, FOUL_Z + 9]} material={mats.carpet} receiveShadow>
        <planeGeometry args={[width + 6, 8]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -PIT_DEPTH - 0.01, 8]} material={mats.pit}>
        <planeGeometry args={[width + 6, 40]} />
      </mesh>
      {/* ceiling, with a strip light down each lane */}
      <mesh rotation-x={Math.PI / 2} position={[0, CEILING, 8]} material={mats.ceiling}>
        <planeGeometry args={[width + 6, 40]} />
      </mesh>
      {Array.from({ length: LANES }, (_, i) => (
        <mesh key={i} position={[laneX(i), CEILING - 0.02, 9]} material={mats.light}>
          <boxGeometry args={[0.12, 0.02, 16]} />
        </mesh>
      ))}
      {/* the end wall over the pinsetters, with neon bands */}
      <mesh position={[0, CEILING / 2, -1.6]} material={mats.masking}>
        <planeGeometry args={[width + 6, CEILING + 1]} />
      </mesh>
      <mesh position={[0, 2.0, -0.88]} material={mats.neon}>
        <boxGeometry args={[LANES * SPACING, 0.04, 0.02]} />
      </mesh>
      <mesh position={[0, 0.62, -0.88]} material={mats.neon2}>
        <boxGeometry args={[LANES * SPACING, 0.03, 0.02]} />
      </mesh>
      {/* side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + 0.5), CEILING / 2, 8]} rotation-y={-s * (Math.PI / 2)} material={mats.masking}>
          <planeGeometry args={[40, CEILING + 1]} />
        </mesh>
      ))}
      {/* ball returns between lanes 1-2 and 3-4 */}
      {[0.5, 2.5].map((k) => (
        <group key={k} position={[laneX(k), 0, FOUL_Z + 2.4]}>
          <mesh position={[0, 0.35, 0]} material={mats.hood} castShadow>
            <sphereGeometry args={[0.36, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.17, 0.6]} material={mats.hood}>
            <boxGeometry args={[0.4, 0.34, 1.2]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Lights() {
  return (
    <>
      <color attach="background" args={['#07060d']} />
      <fog attach="fog" args={['#07060d', 26, 46]} />
      <hemisphereLight args={['#fff4e8', '#2a2140', 0.55]} />
      <directionalLight position={[2, 6, 4]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}>
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 3, -3, 0.5, 14]} />
      </directionalLight>
      <directionalLight position={[-3, 5, 22]} intensity={0.5} />
      {/* the long strip lights overhead are what draw highlights down the glossy lanes and pins */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#100d1c']} />
        {Array.from({ length: LANES }, (_, i) => (
          <Lightformer key={i} form="rect" intensity={2.6} color="#fff6e6" position={[laneX(i), 5, 8]} rotation-x={Math.PI / 2} scale={[0.3, 24, 1]} />
        ))}
        <Lightformer form="rect" intensity={1.2} color="#ff3fa4" position={[0, 2, -6]} scale={[12, 1, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#3ad6ff" position={[0, 1, 30]} rotation-y={Math.PI} scale={[12, 2, 1]} />
      </Environment>
    </>
  )
}

// The camera: behind the bowler while aiming, chasing the ball down the lane, then a look at what is left standing.
function CameraRig({ lanes, active, view }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 0.3, 4))
  const pos = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame((_, dt) => {
    const lane = lanes[active]
    const x = laneX(active)
    const b = lane.ball
    let p
    let t
    if (view === 'pins' || (lane.rolling && !b.active && !settled(lane))) {
      p = [x, 0.95, 3.1]
      t = [x, 0.2, -0.4]
    } else if (lane.rolling && b.active && b.pos.y > -0.3) {
      // chase it, staying behind and a little above
      const z = Math.max(3.3, b.pos.z + 3.4)
      p = [x + b.pos.x * 0.5, 0.75 + Math.min(0.6, (z - 3.3) * 0.05), z]
      t = [x + b.pos.x * 0.6, 0.12, Math.max(-0.5, b.pos.z - 6)]
    } else {
      p = [x, 1.5, FOUL_Z + 3.5]
      t = [x, 0.15, 3]
    }
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 4)
    first.current = false
    pos.current.lerp(new THREE.Vector3(...p), k)
    look.current.lerp(new THREE.Vector3(...t), k)
    camera.position.copy(pos.current)
    camera.lookAt(look.current)
  })
  return null
}

function World({ api, aim, tvs, active, sound, onSettled, onRolling, view }) {
  const parts = useParts()
  const lanes = useMemo(() => Array.from({ length: LANES }, () => createLane()), [])
  const cb = useRef({})
  cb.current = { onSettled, onRolling, sound }

  // ---- sound ----
  const audio = useRef(null)
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, s) => {
    if (!cb.current.sound) return
    if (!audio.current) audio.current = createPinAudio()
    audio.current?.[name](s)
  }

  useImperativeHandle(
    api,
    () => ({
      bowl(i, t) {
        bowl(lanes[i], t)
        lanes[i].reported = false
        if (cb.current.sound && !audio.current) audio.current = createPinAudio()
      },
      sweep(i, fresh) {
        return sweep(lanes[i], fresh)
      },
      standing(i) {
        return standing(lanes[i])
      },
      reset() {
        lanes.forEach((l) => sweep(l, true))
      },
    }),
    [lanes],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const n = Math.max(1, Math.ceil(dt / SUB))
    for (const [i, lane] of lanes.entries()) {
      const busy = lane.rolling || lane.ball.active || lane.pins.some((p) => p.active)
      if (!busy) continue
      for (let k = 0; k < n; k++) stepLane(lane, dt / n, i === active ? play : undefined)
      if (lane.rolling && !lane.reported && settled(lane)) {
        lane.reported = true
        cb.current.onSettled?.(i, standing(lane))
      }
    }
    const b = lanes[active].ball
    if (audio.current) audio.current.roll(b.active && b.grounded ? b.vel.length() : 0)
  })

  return (
    <>
      <Lights />
      <House parts={parts} />
      {lanes.map((lane, i) => (
        <Lane key={i} index={i} lane={lane} parts={parts} aim={aim} tv={tvs[i]} active={i === active} />
      ))}
      <CameraRig lanes={lanes} active={active} view={view} />
    </>
  )
}

/**
 * The alley, ready to drop into a page. Props:
 *   active    the lane being bowled on (0-3)
 *   aim       a ref holding { x, angle, visible }: where the ball sits and heads before the throw
 *   tvs       one object per lane for its TV (see tv.js)
 *   sound     pin clatter and the rumble
 *   onSettled(lane, standing[10]) once the ball has gone and the pins have stopped
 * The ref gives bowl(lane, { x, angle, speed, hook }), sweep(lane, freshRack), standing(lane) and reset().
 */
const Alley = forwardRef(function Alley(props, ref) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [laneX(0), 1.5, FOUL_Z + 3.5], fov: 50, near: 0.05, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
      <World api={ref} {...props} />
    </Canvas>
  )
})
export default Alley
export { OIL_END_Z }
