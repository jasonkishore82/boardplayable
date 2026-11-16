import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { CARD_H, CARD_W, backTexture, cardShape, faceGeometry, faceTexture, paperTexture } from './faces.js'
import { createDeckAudio } from './audio.js'

// The One Card table, seen head on like the deck scene: your hand fanned along
// the bottom, the draw pile and discards in the middle, and the other players'
// hands (face down, smaller) round the top. Every card is its own mesh keyed by
// card id, so when a card changes place it flies there and turns over on the way.

export const SUIT_COLORS = ['#d8262b', '#f2c418', '#2f9a3a', '#1f7fd1']
const T = 0.04
const LAYER = 0.06
const FAN_R = 14

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8d8f93']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 12, 6]} rotation-x={Math.PI / 2.4} scale={[20, 8, 1]} />
      <Lightformer form="rect" intensity={2} color="#fff3e6" position={[-12, 3, 8]} rotation-y={Math.PI / 3} scale={[3, 14, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#eef3ff" position={[12, 3, 8]} rotation-y={-Math.PI / 3} scale={[3, 14, 1]} />
    </Environment>
  )
}

// a hand of n cards fanned round a pivot below it; the arc narrows as the hand grows
function fan(i, n) {
  const spread = n > 1 ? Math.min(0.17, 1.1 / (n - 1)) : 0
  const a = (i - (n - 1) / 2) * spread
  return {
    x: Math.sin(a) * FAN_R,
    y: Math.cos(a) * FAN_R - FAN_R,
    z: i * LAYER,
    rz: -a,
  }
}

// a fixed small tilt per card, so the discard pile looks tossed
const tilt = (id) => (((id * 2654435761) % 1000) / 1000 - 0.5) * 0.7
const nudge = (id, k) => ((((id + k) * 40503) % 100) / 100 - 0.5) * 0.8

// Table geometry for a given screen shape: wide screens seat players to the sides,
// tall ones squeeze them in towards the middle.
function tableLayout(aspect) {
  const tall = aspect < 1
  return {
    rx: tall ? 9 : 21,
    ry: tall ? 17 : 13,
    hand: { x: 0, y: tall ? -17 : -12.5 },
    handScale: tall ? 0.85 : 1,
    oppScale: tall ? 0.42 : 0.5,
    draw: { x: tall ? -3.6 : -4.2, y: 1.2 },
    discard: { x: tall ? 3.6 : 4.2, y: 1.2 },
    view: tall ? { w: 30, h: 50, cy: -1 } : { w: 56, h: 37, cy: -0.5 },
  }
}

// seats round the table, clockwise from yours at the bottom
export function seatAngle(i, n) {
  return (-2 * Math.PI * i) / n
}
function seatPos(L, i, n) {
  const th = seatAngle(i, n)
  return { x: Math.sin(th) * L.rx, y: -Math.cos(th) * L.ry + 1, th }
}

// Where every visible card should be, keyed by card id.
function layoutCards(state, L, mine) {
  const out = new Map()
  const n = state.players.length
  // draw pile: just the top few, face down
  const drawTop = state.draw.slice(-8)
  drawTop.forEach((c, i) => {
    out.set(c.id, {
      x: L.draw.x,
      y: L.draw.y,
      z: i * T * 1.2,
      rz: 0,
      s: 1,
      up: false,
      zone: 'draw',
      top: i === drawTop.length - 1,
    })
  })
  // discards: the last ten, face up, each at its own angle
  const disc = state.discard.slice(-10)
  disc.forEach((c, i) => {
    out.set(c.id, {
      x: L.discard.x + nudge(c.id, 1),
      y: L.discard.y + nudge(c.id, 2),
      z: i * T * 1.2,
      rz: tilt(c.id),
      s: 1,
      up: true,
      zone: 'discard',
    })
  })
  // your hand, sorted by colour then value
  const hand = mine
  hand.forEach((c, i) => {
    const p = fan(i, hand.length)
    out.set(c.id, {
      x: L.hand.x + p.x * L.handScale,
      y: L.hand.y + p.y * L.handScale,
      z: 2 + p.z,
      rz: p.rz,
      s: L.handScale,
      up: true,
      zone: 'hand',
      order: i,
    })
  })
  // the others: face down, turned to face the middle
  for (let k = 1; k < n; k++) {
    const seat = seatPos(L, k, n)
    const cs = Math.cos(seat.th)
    const sn = Math.sin(seat.th)
    const h = state.players[k].hand
    const showFaces = state.winner !== null
    h.forEach((c, i) => {
      const p = fan(i, h.length)
      const lx = p.x * L.oppScale
      const ly = p.y * L.oppScale
      out.set(c.id, {
        x: seat.x + lx * cs - ly * sn,
        y: seat.y + lx * sn + ly * cs,
        z: 1 + p.z,
        rz: p.rz + seat.th,
        s: L.oppScale,
        up: showFaces,
        zone: 'opp',
      })
    })
  }
  return out
}

const wrap = (a) => {
  a = (a + Math.PI) % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  return a - Math.PI
}

function Card({ card, pose, from, delay, geo, mats, hoverable, raised, onPick }) {
  const outer = useRef()
  const inner = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover && !!onPick)
  const s = useRef(null)
  if (s.current === null) {
    const f = from || pose
    s.current = {
      x: f.x,
      y: f.y,
      z: f.z,
      rz: f.rz,
      sc: f.s,
      flip: f.up ? 0 : 1,
      h: 0,
      r: 0,
      born: null,
    }
  }

  useFrame((st, delta) => {
    const c = s.current
    const now = st.clock.elapsedTime
    if (c.born === null) c.born = now
    if (now - c.born < delay) return
    const dt = Math.min(delta, 1 / 30)
    const k = 1 - Math.exp(-dt * 9)
    const dist = Math.hypot(pose.x - c.x, pose.y - c.y)
    c.x += (pose.x - c.x) * k
    c.y += (pose.y - c.y) * k
    c.z += (pose.z - c.z) * k
    c.rz += wrap(pose.rz - c.rz) * k
    c.sc += (pose.s - c.sc) * k
    c.flip += ((pose.up ? 0 : 1) - c.flip) * Math.min(1, dt * 7)
    c.h += ((hoverable && hover ? 1 : 0) - c.h) * Math.min(1, dt * 12)
    c.r += ((raised ? 1 : 0) - c.r) * Math.min(1, dt * 12)
    const swing = Math.abs(Math.sin(Math.PI * c.flip)) * (CARD_W / 2) * c.sc
    const o = outer.current
    // cards in flight ride above the rest so they never cut through a pile
    o.position.set(c.x, c.y, c.z + Math.min(dist, 8) * 0.6 + swing)
    o.rotation.z = c.rz
    o.scale.setScalar(c.sc)
    const i = inner.current
    i.rotation.y = Math.PI * c.flip
    // playable cards rise but keep their place in the fan; only the card under the pointer comes to the front
    i.position.set(0, Math.max(c.h * 1.4, c.r * 0.8), c.h * 1.5)
  })

  const faceMat = pose.up || s.current.flip < 0.99 ? mats.face(card) : mats.back
  return (
    <group ref={outer}>
      <group ref={inner}>
        <group
          onClick={(e) => {
            if (!onPick) return
            e.stopPropagation()
            onPick()
          }}
          onPointerOver={(e) => {
            if (!hoverable && !onPick) return
            e.stopPropagation()
            setHover(true)
          }}
          onPointerOut={() => setHover(false)}
        >
          <mesh geometry={geo.face} material={faceMat} castShadow receiveShadow />
          <mesh geometry={geo.back} material={mats.back} castShadow receiveShadow />
          <mesh geometry={geo.edge} material={mats.edge} />
        </group>
      </group>
    </group>
  )
}

function useMaterials(brand) {
  const paper = useMemo(() => paperTexture(), [])
  const mats = useMemo(() => {
    const make = (map) =>
      new THREE.MeshPhysicalMaterial({
        map,
        bumpMap: paper,
        bumpScale: 0.35,
        roughness: 0.42,
        clearcoat: 0.5,
        clearcoatRoughness: 0.28,
        sheen: 0.2,
        sheenRoughness: 0.6,
      })
    const faces = new Map()
    return {
      back: make(backTexture(SUIT_COLORS[0], SUIT_COLORS[1], brand)),
      edge: [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.8 })],
      // face textures are drawn the first time a card of that kind and colour turns up
      face(card) {
        const key = `${card.kind}.${card.color}`
        let m = faces.get(key)
        if (!m) {
          m = make(faceTexture(card.kind, SUIT_COLORS[card.color ?? 0], 120, SUIT_COLORS))
          faces.set(key, m)
        }
        return m
      },
      dispose() {
        for (const m of [this.back, ...faces.values()]) {
          m.map?.dispose()
          m.dispose()
        }
        this.edge.forEach((m) => m.dispose())
      },
    }
  }, [paper, brand])
  useEffect(() => () => (mats.dispose(), paper.dispose()), [mats, paper])
  return mats
}

function useGeometry() {
  const geo = useMemo(() => {
    const shape = cardShape()
    const edge = new THREE.ExtrudeGeometry(shape, {
      depth: T,
      bevelEnabled: false,
      curveSegments: 12,
    })
    edge.translate(0, 0, -T / 2)
    const face = faceGeometry(shape)
    face.translate(0, 0, T / 2 + 0.0004)
    const back = faceGeometry(shape)
    back.rotateY(Math.PI)
    back.translate(0, 0, -T / 2 - 0.0004)
    return { edge, face, back }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// the ring of light under the discards, in the colour in play
function ColorRing({ L, color }) {
  const mat = useRef()
  const target = useMemo(() => new THREE.Color(SUIT_COLORS[color]), [color])
  useFrame((_, dt) => mat.current?.color.lerp(target, Math.min(1, dt * 6)))
  return (
    <mesh position={[L.discard.x, L.discard.y, -0.05]}>
      <ringGeometry args={[5.6, 6.4, 64]} />
      <meshBasicMaterial ref={mat} color={SUIT_COLORS[color]} transparent opacity={0.85} toneMapped={false} />
    </mesh>
  )
}

function Felt({ L }) {
  return (
    <mesh position={[0, L.view.cy, -0.3]} receiveShadow>
      <planeGeometry args={[400, 300]} />
      <meshStandardMaterial color="#1f5a43" roughness={0.95} />
    </mesh>
  )
}

function Rig({ L }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const v = L.view
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const d = Math.max(v.h / 2 / tan, v.w / 2 / (tan * aspect)) * 1.05
    camera.position.set(0, v.cy - d * 0.08, d)
    camera.lookAt(0, v.cy, 0)
  }, [camera, size.width, size.height, L])
  return null
}

// Where each other player's name tag goes, in table units: just under their cards, pulled in so it never leaves the screen.
function tagPoint(L, k, n) {
  const seat = seatPos(L, k, n)
  const edge = L.view.w / 2 - 5
  // a side seat's fan runs up and down, so its tag drops further to clear the bottom card
  const side = Math.abs(Math.sin(seat.th)) > 0.9
  return new THREE.Vector3(Math.max(-edge, Math.min(edge, seat.x)), seat.y - (side ? CARD_H * L.oppScale * 0.9 + 2.4 : (CARD_H * L.oppScale) / 2 + 2.6), 3)
}

// Moves the name tags (plain page elements over the canvas) to their seats every frame.
function TagTracker({ L, n, tags }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    for (let k = 1; k < n; k++) {
      const el = tags.current[k]
      if (!el) continue
      v.copy(tagPoint(L, k, n)).project(camera)
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
    }
  })
  return null
}

function Seats({ state, tags, onCatch }) {
  return state.players.map((p, k) => {
    if (k === 0) return null
    const active = state.turn === k && state.winner === null
    return (
      <div
        key={k}
        ref={(el) => (tags.current[k] = el)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 4,
          pointerEvents: 'none',
          transform: 'translate(-9999px, 0)',
        }}
      >
        <div className={`oc-seat${active ? ' oc-seat-on' : ''}${state.winner === k ? ' oc-seat-won' : ''}`}>
          <span className="oc-seat-name">{p.name}</span>
          <span className="oc-seat-count">{p.hand.length}</span>
          {state.called[k] && p.hand.length <= 2 && <span className="oc-seat-one">One!</span>}
          {state.uncalled === k && (
            <button type="button" className="oc-catch" style={{ pointerEvents: 'auto' }} onClick={() => onCatch(k)}>
              Catch!
            </button>
          )}
        </div>
      </div>
    )
  })
}

function Cards({ state, L, mine, playableIds, myTurn, onPlay, onDraw, brand }) {
  const geo = useGeometry()
  const mats = useMaterials(brand)
  const poses = layoutCards(state, L, mine)
  const drawPose = { x: L.draw.x, y: L.draw.y, z: 0.3, rz: 0, s: 1, up: false }
  // remember where each card was last seen, so a card that appears (drawn from deep in the pile) starts there
  const last = useRef(new Map())
  const els = []
  let dealIndex = 0
  for (const [id, pose] of poses) {
    const card = pose.zone === 'hand' ? mine[pose.order] : findCard(state, id)
    const seen = last.current.get(id)
    const from = seen ?? drawPose
    const isDealing = !seen && state.discard.length === 1 && pose.zone !== 'draw'
    const canPick = myTurn && pose.zone === 'hand' && playableIds.has(id)
    const pickDraw = myTurn && pose.zone === 'draw' && pose.top && state.drawn === null
    els.push(
      <Card
        key={`${state.round}-${id}`}
        card={card}
        pose={pose}
        from={from}
        delay={isDealing ? dealIndex++ * 0.035 : 0}
        geo={geo}
        mats={mats}
        hoverable={pose.zone === 'hand' || pickDraw}
        raised={canPick || (pose.zone === 'hand' && state.drawn === id)}
        onPick={canPick ? () => onPlay(id) : pickDraw ? onDraw : null}
      />,
    )
  }
  useEffect(() => {
    const m = new Map()
    for (const [id, pose] of poses) m.set(id, pose)
    last.current = m
  })
  return els
}

function findCard(state, id) {
  for (const zone of [state.discard, state.draw.slice(-8)]) for (const c of zone) if (c.id === id) return c
  for (const p of state.players) for (const c of p.hand) if (c.id === id) return c
  return { id, kind: '0', color: 0 }
}

// keeps the table layout in step with the window's shape
function Scene(props) {
  const { size } = useThree()
  const L = useMemo(() => tableLayout(size.width / size.height), [size.width, size.height])
  return (
    <>
      <Rig L={L} />
      <Felt L={L} />
      <ColorRing L={L} color={props.state.color} />
      <Cards {...props} L={L} />
      <TagTracker L={L} n={props.state.players.length} tags={props.tags} />
    </>
  )
}

export default function Table({ state, mine, playableIds, myTurn, onPlay, onDraw, onCatch, brand = 'BP', sound = true }) {
  // card sounds: a flick when a card lands on the discards, a riffle when cards are drawn
  const audio = useRef(null)
  useEffect(() => {
    if (!sound) return
    audio.current = createDeckAudio()
    return () => {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  const prev = useRef(null)
  useEffect(() => {
    const p = prev.current
    prev.current = state
    if (!p || p.round !== state.round) {
      audio.current?.deal(Math.min(12, state.players.length * 3))
      return
    }
    if (p.discard.at(-1)?.id !== state.discard.at(-1)?.id) audio.current?.flip()
    const held = (s) => s.players.reduce((a, q) => a + q.hand.length, 0)
    const added = held(state) - held(p) + (p.discard.at(-1)?.id !== state.discard.at(-1)?.id ? 1 : 0)
    if (added > 0) audio.current?.deal(added)
  }, [state])

  const tags = useRef([])
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 80], fov: 30, near: 0.5, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
      >
        <color attach="background" args={['#173f30']} />
        <hemisphereLight args={['#ffffff', '#335544', 0.4]} />
        <directionalLight
          position={[-6, 10, 30]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <Studio />
        <Scene
          state={state}
          mine={mine}
          playableIds={playableIds}
          myTurn={myTurn}
          onPlay={onPlay}
          onDraw={onDraw}
          onCatch={onCatch}
          brand={brand}
          tags={tags}
        />
      </Canvas>
      <Seats state={state} tags={tags} onCatch={onCatch} />
    </div>
  )
}
