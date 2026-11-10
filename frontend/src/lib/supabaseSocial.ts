import { ApiError } from './http'
import type { ChatMessage, Friend, FriendLists, SocialBackend } from './socialTypes'
import { supabase } from './supabase'

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function myId(): Promise<string> {
  const { data } = await client().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError(401, 'Not signed in.')
  return id
}

type MessageRow = { id: string; sender_id: string; body: string; created_at: string }
const toMessage = (m: MessageRow): ChatMessage => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })

// Production: friends and messages are Supabase tables, protected by row-level security.
export const supabaseSocial: SocialBackend = {
  async listFriends(): Promise<FriendLists> {
    const me = await myId()
    const { data: rows, error } = await client()
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
      .in('status', ['pending', 'accepted'])
    if (error) throw error

    const others = [...new Set((rows ?? []).map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id)))]
    const names = new Map<string, string>()
    if (others.length) {
      const { data: profiles, error: profileError } = await client().from('profiles').select('id, username').in('id', others)
      if (profileError) throw profileError
      for (const p of profiles ?? []) names.set(p.id, p.username)
    }

    const lists: FriendLists = { friends: [], incoming: [], outgoing: [] }
    for (const r of rows ?? []) {
      const mine = r.requester_id === me
      const userId = mine ? r.addressee_id : r.requester_id
      const friend: Friend = { friendshipId: r.id, userId, username: names.get(userId) ?? 'unknown' }
      if (r.status === 'accepted') lists.friends.push(friend)
      else if (mine) lists.outgoing.push(friend)
      else lists.incoming.push(friend)
    }
    lists.friends.sort((a, b) => a.username.localeCompare(b.username))
    return lists
  },

  async sendRequest(username) {
    const me = await myId()
    const { data: target, error: lookupError } = await client()
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!target) throw new ApiError(404, 'No one has that username.')
    if (target.id === me) throw new ApiError(400, 'That’s you.')
    const { error } = await client().from('friendships').insert({ requester_id: me, addressee_id: target.id })
    if (error) {
      // The unique pair index fires when a request or friendship already exists, in either direction.
      if (error.code === '23505') throw new ApiError(409, 'You already have a request or friendship with them.')
      throw error
    }
  },

  async respond(friendshipId, accept) {
    const { error } = await client()
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
      .eq('id', friendshipId)
    if (error) throw error
  },

  async removeFriend(friendshipId) {
    const { error } = await client().from('friendships').delete().eq('id', friendshipId)
    if (error) throw error
  },

  async getMessages(friendId) {
    const me = await myId()
    const { data, error } = await client()
      .from('messages')
      .select('id, sender_id, body, created_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${me})`)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []).reverse().map(toMessage)
  },

  async sendMessage(friendId, body) {
    const me = await myId()
    const { data, error } = await client()
      .from('messages')
      .insert({ sender_id: me, recipient_id: friendId, body })
      .select('id, sender_id, body, created_at')
      .single()
    if (error) throw error
    return toMessage(data)
  },
}
