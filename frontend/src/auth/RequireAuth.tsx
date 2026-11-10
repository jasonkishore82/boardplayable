import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

// Signed-out users always go back to sign-in, remembering where they were headed.
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// The sign-in page is only for signed-out users.
export function RedirectIfAuthed() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (loading) return null
  if (session) return <Navigate to={from && from !== '/sign-in' ? from : '/games'} replace />
  return <Outlet />
}
