// All runtime configuration comes from VITE_* environment variables.
// Nothing here is hard-coded so the same build runs locally and on Vercel.

const read = (value: string | undefined) => value?.trim() ?? ''

export const env = {
  // 'local' signs in against the Python API's SQLite file instead of Supabase (for testing only).
  authBackend: read(import.meta.env.VITE_AUTH_BACKEND) === 'local' ? ('local' as const) : ('supabase' as const),
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
  apiUrl: read(import.meta.env.VITE_API_URL).replace(/\/+$/, ''),
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
