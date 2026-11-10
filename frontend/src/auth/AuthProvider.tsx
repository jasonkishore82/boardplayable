import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { authBackend } from '../lib/auth'
import type { AppSession, AppUser } from '../lib/authTypes'

type AuthState = {
  session: AppSession | null
  user: AppUser | null
  username: string | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!authBackend) {
      setLoading(false)
      return
    }
    authBackend.getSession().then((current) => {
      setSession(current)
      setLoading(false)
    })
    return authBackend.onChange((next, event) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true })
    })
  }, [navigate])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      username: session?.user.username ?? null,
      loading,
      signOut: async () => {
        await authBackend?.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
