import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RedirectIfAuthed, RequireAuth } from './auth/RequireAuth'
import { FriendsPage } from './features/friends/FriendsPage'
import { GameRoute } from './features/games/GameRoute'
import { GamesPage } from './features/games/GamesPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { missingEnv } from './lib/env'
import { AuthPage } from './pages/auth/AuthPage'
import { FinishSignUpPage } from './pages/auth/FinishSignUpPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { SetupNotice } from './pages/SetupNotice'
import { AppShell } from './shell/AppShell'

export function App() {
  if (missingEnv.length) return <SetupNotice missing={missingEnv} />

  return (
    <AuthProvider>
      <Routes>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/sign-in" element={<AuthPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/finish-signup" element={<FinishSignUpPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/:gameId" element={<GameRoute />} />
            <Route path="/friends/:friendId?" element={<FriendsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/games" replace />} />
      </Routes>
    </AuthProvider>
  )
}
