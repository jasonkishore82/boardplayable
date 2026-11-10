import type { AuthBackend } from './authTypes'
import { env, missingEnv } from './env'
import { localAuth } from './localAuth'
import { supabaseAuth } from './supabaseAuth'

// The sign-in service the app uses. Set VITE_AUTH_BACKEND=local to test against the local SQLite API
// instead of Supabase. Null when required environment variables are missing.
export const authBackend: AuthBackend | null = missingEnv.length
  ? null
  : env.authBackend === 'local'
    ? localAuth
    : supabaseAuth
