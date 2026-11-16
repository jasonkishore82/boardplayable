import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BackArrow } from '../../room/BackArrow'
import type { GameEngineProps } from '../../registry'
import Table, { SUIT_COLORS } from './Table'
import {
  COLOR_NAMES,
  botMove,
  callOne,
  catchOne,
  drawCard,
  handPoints,
  newRound,
  pass,
  play,
  playable,
  top,
  type Card,
  type OneCardState,
} from './rules'
import styles from './OneCard.module.css'

// One Card against the computer: pick how many opponents, then play rounds on
// the 3D table (Table.jsx) until you've had enough. The rules live in rules.ts.

const BOT_NAMES = ['Mila', 'Theo', 'Rin']
const KIND_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2', 'wild', '+4']

// your hand, grouped by colour (wilds last) then by value
const sortHand = (h: Card[]) =>
  h.slice().sort((a, b) => (a.color ?? 4) - (b.color ?? 4) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))

const seatsFor = (bots: number) => [{ name: 'You', bot: false }, ...BOT_NAMES.slice(0, bots).map((name) => ({ name, bot: true }))]

export default function OneCard(_: GameEngineProps) {
  const [game, setGame] = useState<OneCardState | null>(null)
  return createPortal(
    <div className={styles.app}>
      {game ? <Game initial={game} onQuit={() => setGame(null)} /> : <Setup onStart={(bots) => setGame(newRound(seatsFor(bots)))} />}
      <Link to="/games" className={styles.leave}>
        <BackArrow /> Games
      </Link>
    </div>,
    document.body,
  )
}

function Setup({ onStart }: { onStart: (bots: number) => void }) {
  const [bots, setBots] = useState(3)
  return (
    <div className={styles.setup}>
      <div className={styles.panel}>
        <h1 className={styles.title}>One Card</h1>
        <p className={styles.lede}>Match the colour or the value, and be the first to empty your hand. Down to your last card? Call One — or get caught and draw two.</p>
        <p className={styles.label}>Opponents</p>
        <div className={styles.choices}>
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" className={n === bots ? styles.choiceOn : styles.choice} onClick={() => setBots(n)}>
              {n}
            </button>
          ))}
        </div>
        <button type="button" className={styles.primary} onClick={() => onStart(bots)}>
          Deal
        </button>
      </div>
    </div>
  )
}

function Game({ initial, onQuit }: { initial: OneCardState; onQuit: () => void }) {
  const [s, setS] = useState(initial)
  const [picking, setPicking] = useState<number | null>(null) // a wild waiting for its colour

  const myTurn = s.turn === 0 && s.winner === null
  const options = useMemo(() => playable(s, 0), [s])
  const playableIds = useMemo(() => new Set(options.map((c) => c.id)), [options])
  const mine = useMemo(() => sortHand(s.players[0].hand), [s.players])

  const onPlay = useCallback(
    (id: number) => {
      const card = s.players[0].hand.find((c) => c.id === id)
      if (!card) return
      if (card.color === null) setPicking(id)
      else setS((x) => play(x, id))
    },
    [s.players],
  )

  // the computer players: each takes a moment to think, and may catch you if you forgot to call One
  useEffect(() => {
    if (s.winner !== null) return
    if (s.uncalled === 0) {
      const t = setTimeout(() => setS((x) => (x.uncalled !== 0 ? x : Math.random() < 0.8 ? catchOne(x, 1 + Math.floor(Math.random() * (x.players.length - 1))) : { ...x, uncalled: null })), 1300 + Math.random() * 900)
      return () => clearTimeout(t)
    }
    if (s.turn === 0) return
    const t = setTimeout(
      () =>
        setS((x) => {
          if (x.turn === 0 || x.winner !== null) return x
          const m = botMove(x)
          if (m.type === 'draw') return drawCard(x)
          if (m.type === 'pass') return pass(x)
          // bots mostly remember to call One before their second-last card
          let y = x
          if (y.players[y.turn].hand.length === 2 && Math.random() < 0.8) y = callOne(y, y.turn)
          return play(y, m.card, m.color)
        }),
      s.drawn !== null ? 650 : 900 + Math.random() * 500,
    )
    return () => clearTimeout(t)
  }, [s])

  const nextRound = () => {
    setPicking(null)
    setS((x) => newRound(seatsFor(x.players.length - 1), x.scores, x.round + 1, Math.random, x.round % x.players.length))
  }

  const canCall = s.winner === null && !s.called[0] && s.players[0].hand.length <= 2 && (s.players[0].hand.length === 2 ? myTurn : s.uncalled === 0)
  const t = top(s)
  const status =
    s.winner !== null
      ? s.winner === 0
        ? 'You won the round!'
        : `${s.players[s.winner].name} won the round.`
      : myTurn
        ? s.drawn !== null
          ? 'You drew a card that fits — play it or keep it.'
          : options.length
            ? `Your turn — play ${COLOR_NAMES[s.color]}${t.color === null ? '' : ` or a ${t.kind}`}.`
            : 'Nothing fits — draw a card.'
        : `${s.players[s.turn].name} is playing…`

  return (
    <>
      <Table
        state={s}
        mine={mine}
        playableIds={playableIds}
        myTurn={myTurn && picking === null}
        onPlay={onPlay}
        onDraw={() => setS((x) => drawCard(x))}
        onCatch={(p) => setS((x) => (x.uncalled === p ? catchOne(x, 0) : x))}
      />

      <div className={styles.hud}>
        <p className={styles.status} aria-live="polite">
          <span className={styles.dot} style={{ background: SUIT_COLORS[s.color] }} />
          {status}
        </p>
        {s.last && s.winner === null && <p className={styles.last}>{s.last}</p>}
        <p className={styles.dir} title="Direction of play">
          {s.dir === 1 ? '↻' : '↺'} Round {s.round}
        </p>
      </div>

      <div className={styles.actions}>
        {canCall && (
          <button type="button" className={styles.one} onClick={() => setS((x) => callOne(x, 0))}>
            One!
          </button>
        )}
        {myTurn && s.drawn === null && picking === null && (
          <button type="button" className={options.length ? styles.ghost : styles.primary} onClick={() => setS((x) => drawCard(x))}>
            Draw
          </button>
        )}
        {myTurn && s.drawn !== null && (
          <button type="button" className={styles.ghost} onClick={() => setS((x) => pass(x))}>
            Keep it
          </button>
        )}
        <span className={styles.count}>
          {s.players[0].hand.length} card{s.players[0].hand.length === 1 ? '' : 's'}
          {s.called[0] && s.players[0].hand.length <= 2 ? ' · One!' : ''}
        </span>
      </div>

      {picking !== null && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <p className={styles.label}>Pick a colour</p>
            <div className={styles.colors}>
              {COLOR_NAMES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={styles.swatch}
                  style={{ background: SUIT_COLORS[i] }}
                  aria-label={name}
                  onClick={() => {
                    const id = picking
                    setPicking(null)
                    setS((x) => play(x, id, i))
                  }}
                />
              ))}
            </div>
            <button type="button" className={styles.link} onClick={() => setPicking(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {s.winner !== null && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={styles.title}>{s.winner === 0 ? 'You won!' : `${s.players[s.winner].name} wins`}</h2>
            <table className={styles.scores}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Left in hand</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {s.players.map((p, i) => (
                  <tr key={i} className={i === s.winner ? styles.won : undefined}>
                    <td>{p.name}</td>
                    <td>{p.hand.length ? `${p.hand.length} · ${handPoints(p.hand)} pts` : '—'}</td>
                    <td>{s.scores[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.lede}>The winner scores the points left in everyone else’s hands.</p>
            <div className={styles.row}>
              <button type="button" className={styles.primary} onClick={nextRound}>
                Next round
              </button>
              <button type="button" className={styles.ghost} onClick={onQuit}>
                New game
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
