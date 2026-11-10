import { authBackend } from './auth'
import { request } from './http'
import type { ChatMessage, Friend, FriendLists, SocialBackend } from './socialTypes'

type FriendJson = { friendship_id: string; user_id: string; username: string }
type MessageJson = { id: string; sender_id: string; body: string; created_at: string }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await authBackend?.getSession()
  return request<T>(path, init, session?.accessToken)
}

const toFriend = (f: FriendJson): Friend => ({ friendshipId: f.friendship_id, userId: f.user_id, username: f.username })
const toMessage = (m: MessageJson): ChatMessage => ({
  id: m.id,
  senderId: m.sender_id,
  body: m.body,
  createdAt: m.created_at,
})

// Local testing: friends and chat live in the Python API's SQLite file.
export const localSocial: SocialBackend = {
  async listFriends(): Promise<FriendLists> {
    const data = await call<{ friends: FriendJson[]; incoming: FriendJson[]; outgoing: FriendJson[] }>('/v1/local/friends')
    return { friends: data.friends.map(toFriend), incoming: data.incoming.map(toFriend), outgoing: data.outgoing.map(toFriend) }
  },

  async sendRequest(username) {
    await call('/v1/local/friends/request', { method: 'POST', body: JSON.stringify({ username }) })
  },

  async respond(friendshipId, accept) {
    await call(`/v1/local/friends/${encodeURIComponent(friendshipId)}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    })
  },

  async removeFriend(friendshipId) {
    await call(`/v1/local/friends/${encodeURIComponent(friendshipId)}`, { method: 'DELETE' })
  },

  async getMessages(friendId) {
    return (await call<MessageJson[]>(`/v1/local/messages/${encodeURIComponent(friendId)}`)).map(toMessage)
  },

  async sendMessage(friendId, body) {
    return toMessage(
      await call<MessageJson>(`/v1/local/messages/${encodeURIComponent(friendId)}`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    )
  },
}
