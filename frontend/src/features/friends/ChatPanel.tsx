import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { ChatView, type ChatLine } from '../../components/chat/ChatView'
import { ApiError } from '../../lib/http'
import { social } from '../../lib/social'
import type { ChatMessage, Friend } from '../../lib/socialTypes'
import styles from './ChatPanel.module.css'

const POLL_MS = 3000

const sameThread = (a: ChatMessage[] | null, b: ChatMessage[]) =>
  a !== null && a.length === b.length && a.at(-1)?.id === b.at(-1)?.id

// One-to-one chat with a friend. Checks for new messages every few seconds while the tab is visible.
export function ChatPanel({ friend, onBack }: { friend: Friend; onBack: () => void }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let alive = true
    setMessages(null)
    setProblem('')

    async function load() {
      if (!social || document.hidden) return
      try {
        const next = await social.getMessages(friend.userId)
        if (alive) {
          setMessages((prev) => (sameThread(prev, next) ? prev : next))
          setProblem('')
        }
      } catch (error) {
        if (!alive) return
        setProblem(
          error instanceof ApiError && error.status === 403
            ? 'You can only chat with friends.'
            : 'Can’t reach the chat right now. Retrying…',
        )
      }
    }

    void load()
    const timer = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [friend.userId])

  const lines = useMemo<ChatLine[]>(
    () =>
      (messages ?? []).map((m) => ({
        id: m.id,
        mine: m.senderId === user?.id,
        author: m.senderId === user?.id ? null : friend.username,
        body: m.body,
        at: m.createdAt,
      })),
    [messages, user?.id, friend.username],
  )

  async function send(text: string) {
    if (!social) return
    const sent = await social.sendMessage(friend.userId, text)
    // Show it straight away; the next check adds anything the friend replied with.
    setMessages((prev) => (prev?.some((m) => m.id === sent.id) ? prev : [...(prev ?? []), sent]))
    void social.getMessages(friend.userId).then((next) => setMessages(next), () => undefined)
  }

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back to friends">
          <span aria-hidden="true">←</span>
        </button>
        <div className={styles.avatar} aria-hidden="true">
          {friend.username.slice(0, 1).toUpperCase()}
        </div>
        <h2 className={styles.name}>{friend.username}</h2>
      </header>
      <div className={styles.body}>
        <ChatView
          label={`Chat with ${friend.username}`}
          lines={lines}
          onSend={send}
          placeholder={`Message ${friend.username}`}
          emptyText={messages === null ? 'Loading…' : `Say hi to ${friend.username}.`}
          note={problem}
          disabled={messages === null && !problem}
        />
      </div>
    </div>
  )
}
