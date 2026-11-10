import { env, missingEnv } from './env'
import { localSocial } from './localSocial'
import type { SocialBackend } from './socialTypes'
import { supabaseSocial } from './supabaseSocial'

// Friends and chat follow the same switch as sign-in (VITE_AUTH_BACKEND).
export const social: SocialBackend | null = missingEnv.length
  ? null
  : env.authBackend === 'local'
    ? localSocial
    : supabaseSocial
