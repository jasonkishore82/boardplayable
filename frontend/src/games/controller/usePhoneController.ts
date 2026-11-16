import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

// Links a game screen to the dev server's phone-controller relay (frontend/server/controllerRelay.mjs), so a phone
// can steer it. The relay only runs with `npm run dev`; anywhere else (or on an https page, which can't open the
// relay's plain-ws port) `available` stays false and the menu shows no QR code.

export type ControllerGame = 'free-flight' | 'cricket' | 'bowling' | 'badminton'

export type ControllerHandlers = {
  /** Tilt from the phone, each axis -1..1. Cricket: x across the crease,
   *  y the swing (+1 backlift, -1 follow-through). q, when the phone page sends it (cricket): the phone's whole turn
   *  since it was centred, [x, y, z, w]. */
  onTilt?: (x: number, y: number, boost: boolean, q?: [number, number, number, number]) => void
  /** Buttons on the phone: 'primary', 'menu', 'scene', and game-specific ones. */
  onAction?: (action: string) => void
}

const GAME_PORT = 5181
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O or 1/I/L to mix up

// One code per browser tab, so a refresh keeps the phone linked.
function roomCode(): string {
  const key = 'bp-controller-room'
  try {
    const saved = sessionStorage.getItem(key)
    if (saved && /^[A-Z2-9]{4}$/.test(saved)) return saved
  } catch {
    // storage blocked: a fresh code each visit
  }
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  try {
    sessionStorage.setItem(key, code)
  } catch {
    // ignore
  }
  return code
}

export type PhoneController = {
  /** The relay answered: show the QR panel. */
  available: boolean
  /** Phones in this game's room. */
  phones: number
  /** Motion data is actually arriving. */
  ready: boolean
  code: string
  /** The controller page's address (what the QR code encodes). */
  phoneUrl: string | null
  qrSrc: string | null
  send: (msg: Record<string, unknown>) => void
}

export function usePhoneController(game: ControllerGame, handlers: RefObject<ControllerHandlers>): PhoneController {
  const [code] = useState(roomCode)
  const [available, setAvailable] = useState(false)
  const [ip, setIp] = useState<string | null>(null)
  const [phonePort, setPhonePort] = useState(5180)
  const [phones, setPhones] = useState(0)
  const [ready, setReady] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const lastTilt = useRef(0)

  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const usable = typeof window !== 'undefined' && window.location.protocol === 'http:'
  const base = `http://${host}:${GAME_PORT}`

  useEffect(() => {
    const timer = window.setInterval(() => setReady(performance.now() - lastTilt.current < 1500), 400)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!usable) return undefined
    let closed = false
    let retry: number | undefined
    let ws: WebSocket | null = null

    fetch(`${base}/info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((info: { ips?: string[]; phonePort?: number } | null) => {
        if (closed || !info) return
        setIp(info.ips?.[0] ?? null)
        if (info.phonePort) setPhonePort(info.phonePort)
        setAvailable(!!info.ips?.length)
      })
      .catch(() => {
        // no relay running (not `npm run dev`): no phone controller
      })

    const connect = () => {
      if (closed) return
      ws = new WebSocket(`ws://${host}:${GAME_PORT}/gyro-ws`)
      wsRef.current = ws
      ws.onopen = () => ws?.send(JSON.stringify({ type: 'hello', role: 'game', room: code }))
      ws.onclose = () => {
        setPhones(0)
        if (!closed) retry = window.setTimeout(connect, 2000)
      }
      ws.onerror = () => ws?.close()
      ws.onmessage = (e) => {
        let m: { type?: string; phones?: number; x?: number; y?: number; b?: number; q?: unknown; action?: string }
        try {
          m = JSON.parse(e.data)
        } catch {
          return
        }
        if (m.type === 'status') setPhones(m.phones ?? 0)
        else if (m.type === 'tilt') {
          if (performance.now() - lastTilt.current > 1500) setReady(true)
          lastTilt.current = performance.now()
          const q =
            Array.isArray(m.q) && m.q.length === 4 && m.q.every((n) => Number.isFinite(n))
              ? (m.q as [number, number, number, number])
              : undefined
          handlers.current?.onTilt?.(Number(m.x) || 0, Number(m.y) || 0, !!m.b, q)
        } else if (m.type === 'action' && typeof m.action === 'string') handlers.current?.onAction?.(m.action)
      }
    }
    connect()
    return () => {
      closed = true
      window.clearTimeout(retry)
      ws?.close()
      wsRef.current = null
    }
  }, [usable, base, host, code, handlers])

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg))
  }, [])

  return {
    available,
    phones,
    ready: ready && phones > 0,
    code,
    phoneUrl: ip ? `https://${ip}:${phonePort}/controller/${game}.html?room=${code}` : null,
    qrSrc: available ? `${base}/qr?game=${game}&room=${code}` : null,
    send,
  }
}
