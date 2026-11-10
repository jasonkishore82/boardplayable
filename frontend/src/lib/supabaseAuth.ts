import type { Session } from '@supabase/supabase-js'
import type { AppSession, AuthBackend } from './authTypes'
import { ApiError, request } from './http'
import { supabase } from './supabase'

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function toSession(session: Session | null): AppSession | null {
  if (!session) return null
  const { user } = session
  return {
    accessToken: session.access_token,
    user: {
      id: user.id,
      email: user.email ?? '',
      username: (user.user_metadata?.username as string | undefined) ?? null,
      createdAt: user.created_at,
    },
  }
}

// Production sign-in: Supabase Auth, with our API making and emailing the sign-up code.
export const supabaseAuth: AuthBackend = {
  kind: 'supabase',

  async getSession() {
    const { data } = await client().auth.getSession()
    return toSession(data.session)
  },

  onChange(callback) {
    const { data } = client().auth.onAuthStateChange((event, next) =>
      callback(toSession(next), event === 'PASSWORD_RECOVERY' ? 'PASSWORD_RECOVERY' : undefined),
    )
    return () => data.subscription.unsubscribe()
  },

  async signInWithPassword(email, password) {
    const { error } = await client().auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  async sendCode(email) {
    await request('/v1/otp/send', { method: 'POST', body: JSON.stringify({ email }) })
    return {}
  },

  async verifyCode(email, code) {
    // Our API checks the code, then hands back a one-time token that Supabase turns into a session.
    const { token_hash } = await request<{ token_hash: string }>('/v1/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
    const { error } = await client().auth.verifyOtp({ token_hash, type: 'magiclink' })
    if (error) throw error
  },

  async completeSignUp(username, password) {
    const { error: claimError } = await client().rpc('complete_signup', { name: username })
    if (claimError) {
      if (claimError.code === '23505' || claimError.message.toLowerCase().includes('duplicate')) {
        throw new ApiError(409, 'That username is taken.')
      }
      throw claimError
    }
    const { error } = await client().auth.updateUser({ password, data: { username } })
    if (error) throw error
  },

  async signOut() {
    await client().auth.signOut()
  },

  async deleteAccount() {
    const { error } = await client().rpc('delete_my_account')
    if (error) throw error
  },

  async getStats() {
    const { data: auth } = await client().auth.getSession()
    const userId = auth.session?.user.id
    if (!userId) return { played: 0, won: 0 }
    const { data } = await client().from('game_stats').select('played, won').eq('user_id', userId)
    const rows = data ?? []
    return {
      played: rows.reduce((n, r) => n + r.played, 0),
      won: rows.reduce((n, r) => n + r.won, 0),
    }
  },

  async requestPasswordReset(email) {
    const { error } = await client().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  async setPassword(password) {
    const { error } = await client().auth.updateUser({ password })
    if (error) throw error
  },
}
