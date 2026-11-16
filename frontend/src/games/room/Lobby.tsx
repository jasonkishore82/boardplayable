import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { botAvatarUrls } from '../../lib/avatars'
import { request } from '../../lib/http'
import { newRoomCode, parseRoomCode } from './code'
import { BackArrow } from './BackArrow'
import styles from './Room.module.css'
import { hasScene } from '../../three/scenes'
import { readSavedView, saveView, type ViewMode } from './tableView'

type Props = {
  gameId: string
  title: string
  /** One sentence under the title. */
  lede: string
  /** Offer a computer opponent after "Start a game". Only for games the server can play. */
  bots?: boolean
  /** Let the player choose a side before starting, e.g. white or black in chess. The first one is the default. */
  sides?: { id: string; label: string }[]
  /** More ways to play, shown under the join form (e.g. cricket's 3D nets). */
  children?: ReactNode
}

type Step = 'home' | 'mode' | 'bot'

type BotInfo = { id: string; name: string; description: string; available: boolean }

// /games/<id> is the lobby. /games/<id>?room=<code> is a table.
export function Lobby({ gameId, title, lede, bots = false, sides, children }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('home')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const has3d = hasScene(gameId)
  const [view, setView] = useState<ViewMode>(readSavedView)
  const [side, setSide] = useState(sides?.[0]?.id)
  // Added to every table link, so the choice is used whichever way the game is started.
  const seatParam = sides && side ? `&seat=${side}` : ''

  function join(event: FormEvent) {
    event.preventDefault()
    const parsed = parseRoomCode(code)
    if (!parsed) {
      setError('That isn’t a game code. Enter the 6-digit code or paste the invite link.')
      return
    }
    navigate(`/games/${gameId}?room=${parsed}${seatParam}`)
  }

  const startMultiplayer = () => navigate(`/games/${gameId}?room=${newRoomCode()}${seatParam}`)

  if (step === 'mode') {
    return (
      <Steps title="How do you want to play?" onBack={() => setStep('home')}>
        <Choice title="Multiplayer" detail="Play a friend online. You get a link to send them." onClick={startMultiplayer} />
        <Choice title="Play a bot" detail="Practise against the computer." onClick={() => setStep('bot')} />
      </Steps>
    )
  }

  if (step === 'bot') return <BotPicker gameId={gameId} seatParam={seatParam} onBack={() => setStep('mode')} />

  return (
    <div className={styles.lobby}>
      <Link to="/games" className={styles.back}>
        <BackArrow /> Games
      </Link>
      <h1>{title}</h1>
      <p className={styles.lede}>{lede}</p>

      {has3d && (
        <div className={styles.viewChoice} role="group" aria-label="Board style">
          {(
            [
              ['standard', '2D board'],
              ['3d', '3D board'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={[styles.viewChoiceItem, view === id && styles.viewChoiceActive].filter(Boolean).join(' ')}
              onClick={() => {
                setView(id)
                saveView(id)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {sides && (
        <div className={styles.viewChoice} role="group" aria-label="Play as">
          {sides.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={side === option.id}
              className={[styles.viewChoiceItem, side === option.id && styles.viewChoiceActive]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSide(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <Button onClick={() => (bots ? setStep('mode') : startMultiplayer())}>Start a game</Button>

      <form className={styles.join} onSubmit={join} noValidate>
        <TextField
          label="Have a code?"
          placeholder="Game code or invite link"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError('')
          }}
          error={error || undefined}
        />
        <Button type="submit" variant="secondary" disabled={!code.trim()}>
          Join game
        </Button>
      </form>
      {children}
    </div>
  )
}

function BotPicker({ gameId, seatParam, onBack }: { gameId: string; seatParam: string; onBack: () => void }) {
  const navigate = useNavigate()
  const [bots, setBots] = useState<BotInfo[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [highlighted, setHighlighted] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setBots(null)
    setFailed(false)
    request<BotInfo[]>(`/v1/bots?game=${encodeURIComponent(gameId)}`).then(
      (list) => alive && setBots(list),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  return (
    <Steps title="Choose a bot" onBack={onBack} cards>
      {failed && (
        <div className={styles.problemBox} role="alert">
          <p>Can’t reach the game server to load the bots.</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
      {!bots && !failed && <p className={styles.muted}>Loading bots…</p>}
      {bots && bots.length > 0 && (
        <BotPreview bot={bots.find((b) => b.id === highlighted) ?? bots.find((b) => b.available) ?? bots[0]} />
      )}
      {bots?.map((bot) => (
        <Choice
          key={bot.id}
          title={bot.name}
          detail={bot.available ? bot.description : 'Not installed on this server yet.'}
          avatar={<Avatar name={bot.name} src={botAvatarUrls(bot.id)} size={72} />}
          card
          disabled={!bot.available}
          onHighlight={() => setHighlighted(bot.id)}
          onClick={() => navigate(`/games/${gameId}?room=${newRoomCode()}&bot=${bot.id}${seatParam}`)}
        />
      ))}
    </Steps>
  )
}

type StepsProps = {
  title: string
  onBack: () => void
  /** Lay the choices out as a grid of square cards instead of a list of rows. */
  cards?: boolean
  children: ReactNode
}

function Steps({ title, onBack, cards, children }: StepsProps) {
  return (
    <div className={[styles.lobby, cards && styles.lobbyWide].filter(Boolean).join(' ')}>
      <button type="button" className={styles.backButton} onClick={onBack}>
        <BackArrow /> Back
      </button>
      <h1>{title}</h1>
      <div className={[styles.choices, cards && styles.choiceGrid].filter(Boolean).join(' ')}>{children}</div>
    </div>
  )
}

// A big portrait of the bot you are pointing at, with its name, above the list.
function BotPreview({ bot }: { bot: BotInfo }) {
  return (
    <div className={styles.botPreview} aria-live="polite">
      <Avatar name={bot.name} src={botAvatarUrls(bot.id)} size={112} />
      <div className={styles.botPreviewText}>
        <p className={styles.botPreviewName}>{bot.name}</p>
        <p className={styles.choiceDetail}>{bot.available ? bot.description : 'Not installed on this server yet.'}</p>
      </div>
    </div>
  )
}

function Choice({
  title,
  detail,
  onClick,
  disabled,
  avatar,
  card,
  onHighlight,
}: {
  title: string
  detail: string
  onClick: () => void
  disabled?: boolean
  /** A picture shown at the left of the card. */
  avatar?: ReactNode
  /** Draw it as a square card: the picture on top, the words centred under it. */
  card?: boolean
  /** Called when the card is pointed at or focused. */
  onHighlight?: () => void
}) {
  return (
    <button
      type="button"
      className={[styles.choice, card ? styles.choiceCard : avatar && styles.choiceWithAvatar]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onHighlight}
      onFocus={onHighlight}
    >
      {avatar}
      <span className={styles.choiceText}>
        <span className={styles.choiceTitle}>{title}</span>
        <span className={styles.choiceDetail}>{detail}</span>
      </span>
    </button>
  )
}
