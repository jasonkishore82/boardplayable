import { authBackend } from './auth'
import { env } from './env'
import { request } from './http'

export { ApiError } from './http'

// Thin client for the Python API. Sends the signed-in user's access token with every call.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await authBackend?.getSession()
  return request<T>(path, init, session?.accessToken)
}

// WebSocket URL for a live room, derived from the API URL.
export function roomSocketUrl(roomId: string, accessToken: string): string {
  const base = env.apiUrl.replace(/^http/, 'ws')
  return `${base}/v1/rooms/${encodeURIComponent(roomId)}?token=${encodeURIComponent(accessToken)}`
}
