import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { ApiError } from '../../lib/http'
import { social } from '../../lib/social'
import type { Friend } from '../../lib/socialTypes'
import { ChatPanel } from './ChatPanel'
import styles from './FriendsPage.module.css'
import { useFriendLists } from './useFriendLists'

// /friends and /friends/:friendId. Friends and requests on one side, the open chat on the other.
export function FriendsPage() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const { lists, error, reload } = useFriendLists()
  const selected = lists?.friends.find((f) => f.userId === friendId)

  return (
    <>
      <PageHeader title="Friends">Chat and play with people you know.</PageHeader>

      <div className={[styles.layout, friendId && styles.hasChat].filter(Boolean).join(' ')}>
        <div className={styles.side}>
          {error && (
            <p className={styles.problem} role="alert">
              {error}
            </p>
          )}

          {lists && lists.incoming.length > 0 && (
            <Section title="Requests">
              <ul className={styles.list}>
                {lists.incoming.map((r) => (
                  <li key={r.friendshipId} className={styles.request}>
                    <Person name={r.username} />
                    <div className={styles.actions}>
                      <Button variant="secondary" onClick={() => answer(r, true)}>
                        Accept
                      </Button>
                      <Button variant="quiet" onClick={() => answer(r, false)}>
                        Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Your friends">
            {!lists ? (
              <p className={styles.muted}>Loading…</p>
            ) : lists.friends.length === 0 ? (
              <EmptyState title="No friends yet">Add someone by username to start chatting.</EmptyState>
            ) : (
              <ul className={styles.list}>
                {lists.friends.map((f) => (
                  <li key={f.userId}>
                    <Link
                      to={`/friends/${f.userId}`}
                      className={[styles.friend, f.userId === friendId && styles.current].filter(Boolean).join(' ')}
                      aria-current={f.userId === friendId ? 'page' : undefined}
                    >
                      <Person name={f.username} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {lists && lists.outgoing.length > 0 && (
              <ul className={[styles.list, styles.waiting].join(' ')}>
                {lists.outgoing.map((r) => (
                  <li key={r.friendshipId} className={styles.request}>
                    <span className={styles.muted}>Waiting for {r.username}</span>
                    <Button variant="quiet" onClick={() => cancel(r)}>
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Add a friend">
            <AddFriend onSent={reload} />
          </Section>
        </div>

        <div className={styles.chat}>
          {selected ? (
            <ChatPanel key={selected.userId} friend={selected} onBack={() => navigate('/friends')} />
          ) : (
            <div className={styles.pick}>
              <EmptyState title={friendId && lists ? 'That person isn’t on your friends list' : 'Pick a friend to chat'}>
                Your conversations show up here.
              </EmptyState>
            </div>
          )}
        </div>
      </div>
    </>
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

function Person({ name }: { name: string }) {
  return (
    <span className={styles.person}>
      <span className={styles.avatar} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.personName}>{name}</span>
    </span>
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
      <TextField
        label="Username"
        placeholder="their_username"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={message && !message.ok ? message.text : undefined}
        hint={message?.ok ? message.text : undefined}
      />
      <Button type="submit" variant="secondary" loading={sending} disabled={!username.trim()}>
        Send request
      </Button>
    </form>
  )
}
