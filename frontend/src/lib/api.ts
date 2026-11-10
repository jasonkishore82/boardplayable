import { env } from './env'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Thin client for the Python API. Sends the Supabase access token with every call.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.apiUrl) throw new Error('VITE_API_URL is not set')
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const headers = new Headers(init.headers)
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${env.apiUrl}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = typeof body?.detail === 'string' ? body.detail : ''
    } catch {
      // Not JSON; fall through to the status text.
    }
    throw new ApiError(res.status, detail || `API ${res.status}`)
  }
  return res.json() as Promise<T>
}

// WebSocket URL for a live room, derived from the API URL.
export function roomSocketUrl(roomId: string, accessToken: string): string {
  const base = env.apiUrl.replace(/^http/, 'ws')
  return `${base}/v1/rooms/${encodeURIComponent(roomId)}?token=${encodeURIComponent(accessToken)}`
}
