// All runtime configuration comes from VITE_* environment variables.
// Nothing here is hard-coded so the same build runs locally and on Vercel.

const read = (value: string | undefined) => value?.trim() ?? ''

// VITE_API_URL=auto points at port 8001 on whatever address the page was opened from, so one build
// works on localhost and on a LAN address like http://192.168.1.20:5175 with no edits.
const rawApiUrl = read(import.meta.env.VITE_API_URL)
const apiUrl =
  rawApiUrl === 'auto' && typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : rawApiUrl.replace(/\/+$/, '')

export const env = {
  // 'local' signs in against the Python API's SQLite file instead of Supabase (for testing only).
  authBackend: read(import.meta.env.VITE_AUTH_BACKEND) === 'local' ? ('local' as const) : ('supabase' as const),
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
  apiUrl,
}

export const missingEnv = (
  env.authBackend === 'local'
    ? [!env.apiUrl && 'VITE_API_URL']
    : [
        !env.supabaseUrl && 'VITE_SUPABASE_URL',
        !env.supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
        !env.apiUrl && 'VITE_API_URL',
      ]
).filter(Boolean) as string[]
