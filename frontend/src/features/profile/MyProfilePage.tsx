import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { GameGlyph } from '../../games/GameGlyph'
import { userAvatarUrl } from '../../lib/avatars'
import { social } from '../../lib/social'
import type { Friend, FriendLists } from '../../lib/socialTypes'
import { useGameHistory, type PlayedGame, type Result } from '../../lib/gameHistory'
import {
  removeProfilePicture,
  setProfilePicture,
  squarePictureToDataUrl,
  useProfilePicture,
} from '../../lib/profilePicture'
import styles from './MyProfilePage.module.css'

const RESULT_LABEL: Record<Result, string> = { won: 'Won', lost: 'Lost', draw: 'Draw' }

/** The player's profile: a picture they can change, their name, their totals, and the games they have played. */
export function MyProfilePage() {
  const { user, username } = useAuth()
  const history = useGameHistory(user?.id)
  const own = useProfilePicture(user?.id)
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | Result>('all')
  const [lists, setLists] = useState<FriendLists | null>(null)
  const [openList, setOpenList] = useState<PeopleTab | null>(null)

  useEffect(() => {
    if (!social || !user) return
    let live = true
    social.listFriends().then(
      (found) => live && setLists(found),
      () => live && setLists({ friends: [], incoming: [], outgoing: [] }),
    )
    return () => {
      live = false
    }
  }, [user])

  const name = username ?? user?.email?.split('@')[0] ?? 'Player'
  const won = history.filter((g) => g.result === 'won').length
  const lost = history.filter((g) => g.result === 'lost').length
  const draws = history.filter((g) => g.result === 'draw').length
  const shown = filter === 'all' ? history : history.filter((g) => g.result === filter)

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked || !user) return
    setError('')
    try {
      setProfilePicture(user.id, await squarePictureToDataUrl(picked))
    } catch {
      setError('Couldn’t use that picture. Try a JPEG or PNG.')
    }
  }

  return (
    <div className={styles.sheet} data-theme="light">
      <section className={styles.top}>
        <button
          type="button"
          className={styles.picture}
          onClick={() => file.current?.click()}
          aria-label="Change profile picture"
          title="Change profile picture"
        >
          <Avatar name={name} src={own ?? userAvatarUrl(user?.avatarUrl)} size={112} />
          <span className={styles.change} aria-hidden="true">
            Change
          </span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={upload} />

        <div className={styles.who}>
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.meta}>
            {user?.isGuest ? 'Guest' : user?.email}
            {user?.createdAt && (
              <>
                {' '}
                · Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </>
            )}
          </p>
          <dl className={styles.counts}>
            <Count label="Games" value={history.length} />
            {PEOPLE_TABS.map((tab) => (
              <Count
                key={tab.id}
                label={tab.label}
                value={lists ? lists[tab.key].length : 0}
                active={openList === tab.id}
                onPress={() => setOpenList(openList === tab.id ? null : tab.id)}
              />
            ))}
          </dl>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => file.current?.click()}>
              {own ? 'Change picture' : 'Add a picture'}
            </Button>
            {own && user && (
              <Button variant="quiet" onClick={() => removeProfilePicture(user.id)}>
                Remove picture
              </Button>
            )}
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      {openList && lists && (
        <section className={styles.people} aria-label={PEOPLE_TABS.find((t) => t.id === openList)?.label}>
          <div className={styles.filters} role="group" aria-label="Show">
            {PEOPLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={styles.filter}
                aria-pressed={openList === tab.id}
                onClick={() => setOpenList(tab.id)}
              >
                {tab.label} · {lists[tab.key].length}
              </button>
            ))}
          </div>
          <ul className={styles.list}>
            {lists[PEOPLE_TABS.find((t) => t.id === openList)!.key].length === 0 && (
              <li className={styles.empty}>{PEOPLE_TABS.find((t) => t.id === openList)!.empty}</li>
            )}
            {lists[PEOPLE_TABS.find((t) => t.id === openList)!.key].map((person: Friend) => (
              <li key={person.friendshipId} className={styles.person}>
                <Avatar name={person.username} size={40} />
                <span className={styles.title}>{person.username}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.history} aria-labelledby="history-title">
        <div className={styles.historyHead}>
          <h2 id="history-title">
            Game history
            <span className={styles.record}>
              {won} won · {lost} lost · {draws} {draws === 1 ? 'draw' : 'draws'}
            </span>
          </h2>
          <div className={styles.filters} role="group" aria-label="Show">
            {(['all', 'won', 'lost', 'draw'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.filter}
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {option === 'all' ? 'All' : RESULT_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className={styles.empty}>
            {history.length === 0
              ? 'No games yet. Finished games show up here with the result. They are kept on this device.'
              : 'No games match that filter.'}
          </p>
        ) : (
          <ul className={styles.list}>
            {shown.map((game) => (
              <Row key={game.id} game={game} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/**
 * The people lists. This app has friend requests, not follows, so: Friends are accepted friends, Followers are people
 * who have asked to be your friend, and Following are the requests you have sent.
 */
type PeopleTab = 'friends' | 'followers' | 'following'
const PEOPLE_TABS: { id: PeopleTab; key: keyof FriendLists; label: string; empty: string }[] = [
  { id: 'friends', key: 'friends', label: 'Friends', empty: 'No friends yet. Add some from the Friends tab.' },
  { id: 'followers', key: 'incoming', label: 'Followers', empty: 'Nobody has asked to be your friend yet.' },
  { id: 'following', key: 'outgoing', label: 'Following', empty: 'You have no requests waiting for an answer.' },
]

function Count({
  label,
  value,
  active,
  onPress,
}: {
  label: string
  value: number
  active?: boolean
  onPress?: () => void
}) {
  const inner = (
    <>
      <dd>{value}</dd>
      <dt>{label}</dt>
    </>
  )
  // A count that opens a list is a button; a plain count is just text.
  return onPress ? (
    <button type="button" className={styles.count} aria-pressed={active} onClick={onPress}>
      {inner}
    </button>
  ) : (
    <div className={styles.count}>{inner}</div>
  )
}

function Row({ game }: { game: PlayedGame }) {
  return (
    <li className={styles.row}>
      <span className={styles.glyph}>
        <GameGlyph id={game.gameId} size={28} />
      </span>
      <span className={styles.what}>
        <span className={styles.title}>{game.title}</span>
        <span className={styles.sub}>
          vs {game.opponent} · {game.moves} {game.moves === 1 ? 'move' : 'moves'} ·{' '}
          {new Date(game.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </span>
      <span className={styles.result} data-result={game.result}>
        {RESULT_LABEL[game.result]}
      </span>
    </li>
  )
}
