import { env } from './env'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Plain call to the Python API. Pass a token for routes that need a signed-in user.
export async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (!env.apiUrl) throw new Error('VITE_API_URL is not set')
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${env.apiUrl}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = typeof body?.detail === 'string' ? body.detail : ''
    } catch {
      // Not JSON; fall through to the status text.
    }
    throw new ApiError(res.status, detail || `API ${res.status}`)
  }
  return res.json() as Promise<T>
}
