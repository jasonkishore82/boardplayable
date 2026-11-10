import { useCallback, useEffect, useRef, useState } from 'react'
import { roomSocketUrl } from '../../lib/api'
import { authBackend } from '../../lib/auth'

export type RoomPlayer = { id: string; username: string | null }

export type RoomChatMessage = {
  id: string
  from: string
  username: string | null
  text: string
  at: string
}

export type RoomStatus = 'connecting' | 'open' | 'reconnecting' | 'failed'

const MAX_RETRIES = 5

type ServerMessage =
  | { type: 'presence'; players: RoomPlayer[] }
  | { type: 'state'; game: unknown }
  | { type: 'history'; messages: RoomChatMessage[] }
  | ({ type: 'chat' } & RoomChatMessage)
  | { type: 'error'; message: string; fatal?: boolean }
  | { type: 'message'; from: string; data: unknown }

// Connects to a live room over a WebSocket and keeps the table, the player list and the chat up to date.
// `roomId` is the full server id, for example "tic-tac-toe:ab12cd". The game state type is up to the caller.
export function useRoom<State>(roomId: string) {
  const [status, setStatus] = useState<RoomStatus>('connecting')
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [game, setGame] = useState<State | null>(null)
  const [chat, setChat] = useState<RoomChatMessage[]>([])
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    let stopped = false
    let fatal = false
    let attempt = 0
    let timer: number | undefined

    setStatus('connecting')
    setPlayers([])
    setGame(null)
    setChat([])
    setNotice('')
    setFailure('')

    function handle(message: ServerMessage) {
      switch (message.type) {
        case 'presence':
          setPlayers(message.players)
          break
        case 'state':
          setGame(message.game as State)
          setNotice('')
          break
        case 'history':
          setChat(message.messages)
          break
        case 'chat':
          setChat((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
          break
        case 'error':
          if (message.fatal) {
            fatal = true
            setStatus('failed')
            setFailure(message.message)
          } else {
            setNotice(message.message)
          }
          break
      }
    }

    async function connect() {
      const session = await authBackend?.getSession()
      if (stopped) return
      if (!session) {
        setStatus('failed')
        setFailure('Sign in to play.')
        return
      }

      const ws = new WebSocket(roomSocketUrl(roomId, session.accessToken))
      socket.current = ws
      ws.onopen = () => {
        attempt = 0
        setStatus('open')
      }
      ws.onmessage = (event) => {
        try {
          handle(JSON.parse(event.data as string) as ServerMessage)
        } catch {
          // Ignore anything that isn't valid JSON.
        }
      }
      ws.onclose = () => {
        if (socket.current === ws) socket.current = null
        if (stopped || fatal) return
        if (attempt >= MAX_RETRIES) {
          setStatus('failed')
          setFailure('Lost the connection to the table. Reload to rejoin.')
          return
        }
        attempt += 1
        setStatus('reconnecting')
        timer = window.setTimeout(connect, Math.min(1000 * 2 ** attempt, 8000))
      }
    }

    void connect()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      socket.current?.close()
      socket.current = null
    }
  }, [roomId])

  const send = useCallback((message: Record<string, unknown>) => {
    const ws = socket.current
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('Not connected yet. Try again in a moment.')
    ws.send(JSON.stringify(message))
  }, [])

  return { status, players, game, chat, notice, failure, send }
}
