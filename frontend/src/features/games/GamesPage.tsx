import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
import { CATEGORIES, GAMES, formatPlayers, getGame, type CategoryId, type Game } from '../../games/catalog'
import { GameGlyph } from '../../games/GameGlyph'
import { useBackdrop } from '../../lib/backdrop'
import { useGameHistory, type PlayedGame } from '../../lib/gameHistory'
import { social } from '../../lib/social'
import { useFriendLists } from '../friends/useFriendLists'
import { coverShot, coverStyle } from './covers'
import styles from './GamesPage.module.css'

// The Games home screen, laid out as a dashboard. The main column has a search box and category chips, a large
// banner for the selected game (the arrows step through the list), a carousel of games you can play now, the games
// still on their way, and the games you finished recently. The side column describes the selected game, shows your
// record in it, and lists your friends. Everything comes from the catalog, this device's game history and the
// friends list; nothing is made up.

const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export function GamesPage() {
  const { user } = useAuth()
  const history = useGameHistory(user?.id)
  // The dashboard has its own calm background. A photo the player chose in Profile still shows, under a veil;
  // the default animated aurora is too loud behind panels of information, so it is covered.
  const photo = !!useBackdrop().src
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | undefined>(GAMES.find((g) => g.status === 'available')?.id)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GAMES.filter(
      (g) =>
        (category === 'all' || g.category === category) &&
        (!q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)),
    )
  }, [query, category])
  const playable = shown.filter((g) => g.status === 'available')
  const soon = shown.filter((g) => g.status !== 'available')

  // The selection follows the filters: if the chosen game is filtered out, the first one left takes its place.
  const selected = shown.find((g) => g.id === selectedId) ?? playable[0] ?? shown[0]
  const step = (by: number) => {
    if (!selected || shown.length < 2) return
    const i = shown.indexOf(selected)
    setSelectedId(shown[(i + by + shown.length) % shown.length].id)
  }

  return (
    <div className={styles.page} data-home="" data-photo={photo ? '' : undefined}>
      <h1 className="visually-hidden">Games</h1>

      <div className={styles.main}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="visually-hidden">Search games</span>
            <input
              type="search"
              placeholder="Search games"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className={styles.chips} role="group" aria-label="Category">
            {[{ id: 'all' as const, label: 'All' }, ...CATEGORIES].map((c) => (
              <button
                key={c.id}
                type="button"
                className={styles.chip}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <Hero game={selected} onPrev={() => step(-1)} onNext={() => step(1)} canStep={shown.length > 1} />
        ) : (
          <p className={styles.empty}>No games match “{query}”.</p>
        )}

        {playable.length > 0 && (
          <Shelf title="Play now" count={playable.length}>
            {playable.map((game, i) => (
              <Card key={game.id} game={game} index={i} selected={game.id === selected?.id} onSelect={setSelectedId} />
            ))}
          </Shelf>
        )}

        {soon.length > 0 && (
          <Shelf title="Coming soon" count={soon.length} small>
            {soon.map((game, i) => (
              <Card key={game.id} game={game} index={i} selected={game.id === selected?.id} onSelect={setSelectedId} small />
            ))}
          </Shelf>
        )}

        <Recent history={history} onSelect={setSelectedId} />
      </div>

      <aside className={styles.side} aria-label="Selected game and friends">
        {selected && <Detail game={selected} history={history} />}
        {social && <Friends />}
      </aside>
    </div>
  )
}

/* ---------------- Banner ---------------- */

function Hero({ game, onPrev, onNext, canStep }: { game: Game; onPrev: () => void; onNext: () => void; canStep: boolean }) {
  const available = game.status === 'available'
  const shot = coverShot(game)
  return (
    <section
      className={[styles.hero, shot && styles.heroWithShot].filter(Boolean).join(' ')}
      style={coverStyle(game)}
      aria-label={`Featured: ${game.name}`}
    >
      {/* The in-game screenshot fills the banner, darkened toward the text side. Keyed so it fades in per game. */}
      {shot && (
        // The whole frame on the right (never cropped), over a blurred copy of itself that fills the banner.
        <div key={shot} className={styles.heroShots} aria-hidden="true">
          <img className={styles.heroShotBlur} src={shot} alt="" />
          <img className={styles.heroShot} src={shot} alt="" />
        </div>
      )}
      {/* Keyed by the game, so the art and words slide in again when the selection changes. */}
      <div key={game.id} className={styles.heroInner}>
        <div className={styles.heroText}>
          <span className={styles.badge}>
            {categoryLabel(game.category)} · {formatPlayers(game.players)}
          </span>
          <h2 className={styles.heroTitle}>{game.name}</h2>
          <p className={styles.heroDesc}>{game.description}</p>
          {available ? (
            <Link to={`/games/${game.id}`} className={styles.playBig}>
              <PlayIcon /> Play now
            </Link>
          ) : (
            <span className={styles.soonBig}>Coming soon</span>
          )}
        </div>
        {!shot && (
          <div className={styles.heroArt} aria-hidden="true">
            <GameGlyph id={game.id} size={220} />
          </div>
        )}
      </div>
      {canStep && (
        <div className={styles.heroNav}>
          <button type="button" onClick={onPrev} aria-label="Previous game">
            <Chevron dir={-1} />
          </button>
          <button type="button" onClick={onNext} aria-label="Next game">
            <Chevron dir={1} />
          </button>
        </div>
      )}
    </section>
  )
}

/* ---------------- Rows of cards ---------------- */

function Shelf({ title, count, small, children }: { title: string; count: number; small?: boolean; children: ReactNode }) {
  return (
    <section className={styles.shelf} aria-label={title}>
      <header className={styles.shelfHead}>
        <h2>{title}</h2>
        <span className={styles.count}>{count}</span>
      </header>
      <ul className={[styles.cards, small && styles.cardsSmall].filter(Boolean).join(' ')}>{children}</ul>
    </section>
  )
}

function Card({
  game,
  index,
  selected,
  small,
  onSelect,
}: {
  game: Game
  index: number
  selected: boolean
  small?: boolean
  onSelect: (id: string) => void
}) {
  const available = game.status === 'available'
  return (
    <li
      className={[styles.card, small && styles.cardSmall, selected && styles.cardSelected].filter(Boolean).join(' ')}
      style={{ ...coverStyle(game), '--i': index } as CSSProperties}
    >
      {/* The whole card selects the game; the round button plays it. */}
      <button type="button" className={styles.cardSelect} aria-pressed={selected} onClick={() => onSelect(game.id)}>
        <span className={styles.cardArt} aria-hidden="true">
          {coverShot(game) ? (
            <>
              <img className={styles.cardShotBlur} src={coverShot(game)} alt="" loading="lazy" />
              <img className={styles.cardShot} src={coverShot(game)} alt="" loading="lazy" />
            </>
          ) : (
            <GameGlyph id={game.id} size={80} />
          )}
        </span>
        <span className={styles.cardInfo}>
          <span className={styles.cardName}>{game.name}</span>
          <span className={styles.cardMeta}>{available ? categoryLabel(game.category) : 'Soon'}</span>
        </span>
      </button>
      {available && (
        <Link to={`/games/${game.id}`} className={styles.cardPlay} aria-label={`Play ${game.name}`}>
          <PlayIcon />
        </Link>
      )}
    </li>
  )
}

/* ---------------- Recently played ---------------- */

const RESULT_LABEL = { won: 'Won', lost: 'Lost', draw: 'Draw' } as const

function timeAgo(at: number): string {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

function Recent({ history, onSelect }: { history: PlayedGame[]; onSelect: (id: string) => void }) {
  const recent = history.slice(0, 6)
  return (
    <section className={styles.shelf} aria-label="Recently played">
      <header className={styles.shelfHead}>
        <h2>Recently played</h2>
      </header>
      {recent.length === 0 ? (
        <p className={styles.panelEmpty}>Games you finish show up here, with who you played and how it went.</p>
      ) : (
        <ul className={styles.recent}>
          {recent.map((g) => {
            const game = getGame(g.gameId)
            return (
              <li key={g.id}>
                <button type="button" className={styles.recentItem} onClick={() => game && onSelect(game.id)}>
                  <span className={styles.recentIcon} style={game ? coverStyle(game) : undefined}>
                    <GameGlyph id={g.gameId} size={34} />
                  </span>
                  <span className={styles.recentText}>
                    <b>{game?.name ?? g.title}</b>
                    <small>
                      vs {g.opponent} · {timeAgo(g.at)}
                    </small>
                  </span>
                  <span className={styles.result} data-result={g.result}>
                    {RESULT_LABEL[g.result]}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ---------------- Side column ---------------- */

function Detail({ game, history }: { game: Game; history: PlayedGame[] }) {
  const mine = history.filter((h) => h.gameId === game.id)
  const played = mine.length
  const won = mine.filter((h) => h.result === 'won').length
  const rate = played ? Math.round((won / played) * 100) : 0
  const available = game.status === 'available'
  // Solo games (no opponent) have no wins to count, so their record would always read zero.
  const solo = game.players?.max === 1
  return (
    <section className={[styles.panel, styles.detail].join(' ')} style={coverStyle(game)} aria-label={`About ${game.name}`}>
      <div key={game.id} className={styles.detailInner}>
        <div className={styles.detailArt} aria-hidden="true">
          <GameGlyph id={game.id} size={96} />
        </div>
        <h2 className={styles.detailName}>{game.name}</h2>
        <p className={styles.detailMeta}>
          {categoryLabel(game.category)} · {formatPlayers(game.players)}
        </p>

        <h3 className={styles.panelTitle}>About</h3>
        <p className={styles.detailAbout}>{game.description}</p>

        <h3 className={styles.panelTitle}>Your record</h3>
        {solo ? (
          <p className={styles.panelEmpty}>A solo game: no score, nothing to win. Just play.</p>
        ) : (
          <div className={styles.rings}>
            <Ring value={played} max={Math.max(played, 10)} label="Played" color="#4b8bff" />
            <Ring value={won} max={Math.max(played, 1)} label="Won" color="#3ddc4c" />
            <Ring value={rate} max={100} label="Win rate" suffix="%" color="#c56bff" />
          </div>
        )}

        {available ? (
          <Link to={`/games/${game.id}`} className={styles.playWide}>
            <PlayIcon /> Play {game.name}
          </Link>
        ) : (
          <span className={styles.soonWide}>Coming soon</span>
        )}
      </div>
    </section>
  )
}

function Ring({ value, max, label, color, suffix = '' }: { value: number; max: number; label: string; color: string; suffix?: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const frac = max > 0 ? Math.min(value / max, 1) : 0
  return (
    <figure className={styles.ring}>
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
        <circle cx="34" cy="34" r={r} className={styles.ringTrack} />
        <circle
          cx="34"
          cy="34"
          r={r}
          className={styles.ringValue}
          stroke={color}
          strokeDasharray={`${c * frac} ${c}`}
          transform="rotate(-90 34 34)"
        />
      </svg>
      <b>
        {value}
        {suffix}
      </b>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function Friends() {
  const { lists, error } = useFriendLists()
  const friends = lists?.friends ?? []
  const waiting = lists?.incoming.length ?? 0
  return (
    <section className={[styles.panel, styles.friendsPanel].join(' ')} aria-label="Friends">
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Friends {lists && <span className={styles.count}>{friends.length}</span>}</h3>
        <Link to="/friends" className={styles.seeAll}>
          See all
        </Link>
      </header>
      {waiting > 0 && (
        <Link to="/friends" className={styles.requests}>
          {waiting} friend request{waiting === 1 ? '' : 's'} waiting
        </Link>
      )}
      {error ? (
        <p className={styles.panelEmpty}>{error}</p>
      ) : !lists ? (
        <p className={styles.panelEmpty}>Loading…</p>
      ) : friends.length === 0 ? (
        <p className={styles.panelEmpty}>No friends yet. Add someone by username on the Friends tab.</p>
      ) : (
        <ul className={styles.friends}>
          {friends.map((f) => (
            <li key={f.friendshipId}>
              <Avatar name={f.username} size={42} />
              <span className={styles.friendName}>{f.username}</span>
              <Link to="/friends" className={styles.friendBtn}>
                Chat
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------------- Icons ---------------- */

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />
    </svg>
  )
}

function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={dir === 1 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
