import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, missingEnv } from './env'

// Null when Supabase is not in use (local mode) or not configured; the app shows a setup notice instead of crashing.
export const supabase: SupabaseClient | null =
  env.authBackend === 'local' || missingEnv.length
    ? null
    : createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
