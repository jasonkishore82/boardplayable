// All runtime configuration comes from VITE_* environment variables.
// Nothing here is hard-coded so the same build runs locally and on Vercel.

const read = (value: string | undefined) => value?.trim() ?? ''

export const env = {
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
  apiUrl: read(import.meta.env.VITE_API_URL).replace(/\/+$/, ''),
}

export const missingEnv = [
  !env.supabaseUrl && 'VITE_SUPABASE_URL',
  !env.supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean) as string[]
