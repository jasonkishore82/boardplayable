import type { AppSession, AuthBackend } from './authTypes'
import { ApiError, request } from './http'

// Local testing without Supabase: the Python API signs people in against a SQLite file.
// The session lives in this browser's local storage.

const KEY = 'bp_local_session'

type Payload = {
  access_token: string
  user: { id: string; email: string; username: string | null; created_at: string }
}

type Listener = (session: AppSession | null) => void

function load(): AppSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppSession) : null
  } catch {
    return null
  }
}

let current: AppSession | null = load()
let checked = false
const listeners = new Set<Listener>()

function save(session: AppSession | null) {
  current = session
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage can be blocked; the session then lasts until the page reloads.
  }
  listeners.forEach((listener) => listener(session))
}

function fromPayload(payload: Payload): AppSession {
  return {
    accessToken: payload.access_token,
    user: {
      id: payload.user.id,
      email: payload.user.email,
      username: payload.user.username,
      createdAt: payload.user.created_at,
    },
  }
}

function token(): string {
  if (!current) throw new ApiError(401, 'Not signed in.')
  return current.accessToken
}

export const localAuth: AuthBackend = {
  kind: 'local',

  async getSession() {
    if (current && !checked) {
      checked = true
      try {
        // Confirms the saved token still works and refreshes the username.
        save(fromPayload(await request<Payload>('/v1/local/session', {}, current.accessToken)))
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) save(null)
      }
    }
    return current
  },

  onChange(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  async signInWithPassword(email, password) {
    save(fromPayload(await request<Payload>('/v1/local/signin', { method: 'POST', body: JSON.stringify({ email, password }) })))
  },

  async sendCode(email) {
    const res = await request<{ sent: boolean; dev_code?: string }>('/v1/local/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    return { devCode: res.dev_code }
  },

  async verifyCode(email, code) {
    save(fromPayload(await request<Payload>('/v1/local/otp/verify', { method: 'POST', body: JSON.stringify({ email, code }) })))
  },

  async completeSignUp(username, password) {
    const payload = await request<Payload>(
      '/v1/local/signup/complete',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      token(),
    )
    save(fromPayload(payload))
  },

  async signOut() {
    save(null)
  },

  async deleteAccount() {
    await request('/v1/local/account', { method: 'DELETE' }, token())
    save(null)
  },

  async getStats() {
    return request<{ played: number; won: number }>('/v1/local/stats', {}, token())
  },

  async requestPasswordReset() {
    throw new ApiError(501, 'Password reset by email isn’t available in local mode.')
  },

  async setPassword(password) {
    await request('/v1/local/password', { method: 'POST', body: JSON.stringify({ password }) }, token())
  },
}
