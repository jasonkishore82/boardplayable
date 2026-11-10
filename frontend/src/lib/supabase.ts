import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, missingEnv } from './env'

// Null when the project is not configured; the app shows a setup notice instead of crashing.
export const supabase: SupabaseClient | null = missingEnv.length
  ? null
  : createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
