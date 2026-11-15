import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ApiError } from '../../lib/http'
import { social } from '../../lib/social'
import type { Friend } from '../../lib/socialTypes'
import { ChatPanel } from './ChatPanel'
import styles from './FriendsPage.module.css'
import { useFriendLists } from './useFriendLists'

type Tab = 'chats' | 'requests' | 'sent'

const icon = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

// /friends and /friends/:friendId. A chat-app layout: your chats down the left, the open conversation on the right.
// The left side has three tabs: Chats, Requests (people who asked to be your friend) and Sent (requests you made).
export function FriendsPage() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const { lists, error, reload } = useFriendLists()
  const [tab, setTab] = useState<Tab>('chats')
  const selected = lists?.friends.find((f) => f.userId === friendId)

  const tabs: { id: Tab; label: string; badge: number }[] = [
    { id: 'chats', label: 'Chats', badge: 0 },
    { id: 'requests', label: 'Requests', badge: lists?.incoming.length ?? 0 },
    { id: 'sent', label: 'Sent', badge: lists?.outgoing.length ?? 0 },
  ]

  return (
    <div className={[styles.app, friendId && styles.hasChat].filter(Boolean).join(' ')} data-wide="">
      <aside className={styles.side}>
        <header className={styles.sideHead}>
          <h1>Friends</h1>
        </header>

        <AddFriend
          onSent={async () => {
            await reload()
            setTab('sent')
          }}
        />

        <div className={styles.tabs} role="tablist" aria-label="Friends">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="friends-list"
              className={[styles.tab, tab === t.id && styles.tabActive].filter(Boolean).join(' ')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.badge > 0 && (
                <span className={[styles.badge, t.id === 'requests' && styles.badgeHot].filter(Boolean).join(' ')}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.listWrap} id="friends-list" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {error && (
            <p className={styles.problem} role="alert">
              {error}
            </p>
          )}

          {!lists ? (
            <p className={styles.empty}>Loading…</p>
          ) : tab === 'chats' ? (
            lists.friends.length === 0 ? (
              <Empty title="No chats yet">Add someone by username above to start chatting.</Empty>
            ) : (
              <ul className={styles.list}>
                {lists.friends.map((f) => (
                  <li key={f.userId}>
                    <Link
                      to={`/friends/${f.userId}`}
                      className={[styles.row, f.userId === friendId && styles.current].filter(Boolean).join(' ')}
                      aria-current={f.userId === friendId ? 'page' : undefined}
                    >
                      <Avatar name={f.username} size={46} />
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{f.username}</span>
                        <span className={styles.rowSub}>Tap to chat</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : tab === 'requests' ? (
            lists.incoming.length === 0 ? (
              <Empty title="No friend requests">When someone adds you, it shows up here.</Empty>
            ) : (
              <ul className={styles.list}>
                {lists.incoming.map((r) => (
                  <li key={r.friendshipId} className={styles.row}>
                    <Avatar name={r.username} size={46} />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{r.username}</span>
                      <span className={styles.rowSub}>Wants to be your friend</span>
                    </span>
                    <span className={styles.actions}>
                      <button
                        type="button"
                        className={[styles.round, styles.accept].join(' ')}
                        aria-label={`Accept ${r.username}`}
                        onClick={() => answer(r, true)}
                      >
                        <svg {...icon}>
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={[styles.round, styles.decline].join(' ')}
                        aria-label={`Decline ${r.username}`}
                        onClick={() => answer(r, false)}
                      >
                        <svg {...icon}>
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : lists.outgoing.length === 0 ? (
            <Empty title="No requests sent">Requests you send wait here until they are answered.</Empty>
          ) : (
            <ul className={styles.list}>
              {lists.outgoing.map((r) => (
                <li key={r.friendshipId} className={styles.row}>
                  <Avatar name={r.username} size={46} />
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{r.username}</span>
                    <span className={styles.rowSub}>Request sent · waiting</span>
                  </span>
                  <button type="button" className={styles.cancel} onClick={() => cancel(r)}>
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className={styles.chat} aria-label="Conversation">
        {selected ? (
          <ChatPanel key={selected.userId} friend={selected} onBack={() => navigate('/friends')} />
        ) : (
          <div className={styles.pick}>
            <div className={styles.pickIcon}>
              <svg {...icon} width={40} height={40} strokeWidth={1.4}>
                <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />
              </svg>
            </div>
            <h2>{friendId && lists ? 'That person isn’t on your friends list' : 'Pick a chat'}</h2>
            <p>Choose a friend on the left to see your conversation.</p>
          </div>
        )}
      </section>
    </div>
  )

  async function answer(request: Friend, accept: boolean) {
    await social?.respond(request.friendshipId, accept)
    await reload()
  }

  async function cancel(request: Friend) {
    await social?.removeFriend(request.friendshipId)
    await reload()
  }
}

function Empty({ title, children }: { title: string; children: string }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  )
}

function AddFriend({ onSent }: { onSent: () => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = username.trim().toLowerCase()
    if (!name || !social) return
    setSending(true)
    setMessage(null)
    try {
      await social.sendRequest(name)
      setMessage({ text: `Request sent to ${name}.`, ok: true })
      setUsername('')
      await onSent()
    } catch (error) {
      setMessage({
        text: error instanceof ApiError ? error.message : 'Couldn’t send that request. Try again.',
        ok: false,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <form className={styles.add} onSubmit={submit} noValidate>
      <div className={styles.addField}>
        <svg {...icon} width={18} height={18}>
          <path d="M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9" cy="8" r="3.5" />
          <path d="M19 8v6M16 11h6" />
        </svg>
        <input
          aria-label="Add a friend by username"
          placeholder="Add a friend by username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" className={styles.send} disabled={!username.trim() || sending}>
          {sending ? '…' : 'Add'}
        </button>
      </div>
      {message && (
        <p className={message.ok ? styles.ok : styles.bad} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
    </form>
  )
}
