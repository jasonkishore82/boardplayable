// What the app needs from sign-in, whichever service provides it (Supabase, or the local SQLite API).

export type AppUser = {
  id: string
  email: string
  username: string | null
  createdAt: string
}

export type AppSession = {
  accessToken: string
  user: AppUser
}

export type AuthEvent = 'PASSWORD_RECOVERY'

export interface AuthBackend {
  kind: 'supabase' | 'local'
  getSession(): Promise<AppSession | null>
  /** Called whenever the session changes. Returns an unsubscribe function. */
  onChange(callback: (session: AppSession | null, event?: AuthEvent) => void): () => void
  signInWithPassword(email: string, password: string): Promise<void>
  /** Emails a 6-digit code. In local mode it also returns the code so it can be shown on screen. */
  sendCode(email: string): Promise<{ devCode?: string }>
  /** Checks the code and signs the user in. */
  verifyCode(email: string, code: string): Promise<void>
  /** Step 3 of sign-up. Throws ApiError(409) when the username is taken. */
  completeSignUp(username: string, password: string): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
  getStats(): Promise<{ played: number; won: number }>
  requestPasswordReset(email: string): Promise<void>
  setPassword(password: string): Promise<void>
}
