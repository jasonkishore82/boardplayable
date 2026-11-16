import {
  canPick,
  chaseLine,
  innings,
  lastLine,
  mySide,
  overs,
  scoreText,
  sideLabel,
  type CricketState,
} from './rules'
import styles from './Cricket.module.css'

type Props = {
  game: CricketState
  myId: string | undefined
  onPick: (pick: number) => void
}

// The scorecard, the last ball and the six number buttons.
export function Pitch({ game, myId, onPick }: Props) {
  const mine = mySide(game, myId)
  const open = canPick(game, myId)
  const chase = chaseLine(game, myId)
  const order = [game.first, game.first === 'home' ? 'away' : 'home'] as const

  return (
    <div className={styles.pitch}>
      <div className={styles.card}>
        {order.map((side, i) => {
          const yetToBat = i === 1 && game.innings === 1
          const balls = innings(game, side)
          return (
            <div
              key={side}
              className={[styles.team, game.batting === side && !game.winner && styles.batting]
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.teamHead}>
                <span className={styles.teamName}>
                  {game.seats[side]?.username ?? sideLabel(side)}
                  {mine === side && <span className={styles.you}> (you)</span>}
                </span>
                <span className={styles.total}>{yetToBat ? '–' : scoreText(game, side)}</span>
              </div>
              <div className={styles.teamMeta}>
                {yetToBat ? (
                  'Yet to bat'
                ) : (
                  <>
                    {overs(game.balls[side])} of {overs(game.maxBalls)} overs · {game.maxWickets} wickets
                  </>
                )}
              </div>
              {balls.length > 0 && (
                <ol className={styles.balls} aria-label={`${sideLabel(side)} innings, ball by ball`}>
                  {balls.map((mark, n) => (
                    <li key={n} className={mark === 'W' ? styles.wicket : mark === '6' ? styles.six : undefined}>
                      {mark}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
      </div>

      {chase && <p className={styles.chase}>{chase}</p>}

      {game.last && (
        <div className={styles.reveal} aria-hidden="true" key={`${game.history.length}`}>
          <span className={styles.hand}>
            <small>Bat</small>
            {game.last.bat}
          </span>
          <span className={styles.vs}>v</span>
          <span className={styles.hand}>
            <small>Bowl</small>
            {game.last.bowl}
          </span>
        </div>
      )}
      <p className={[styles.what, game.last?.out && styles.out].filter(Boolean).join(' ')} aria-live="polite">
        {lastLine(game, myId)}
      </p>

      {mine && !game.winner && (
        <div className={styles.picks} role="group" aria-label="Pick a number">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className={styles.pick} disabled={!open} onClick={() => onPick(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
