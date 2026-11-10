// Friends and direct messages, whichever service provides them (Supabase, or the local SQLite API).

export type Friend = {
  friendshipId: string
  userId: string
  username: string
}

export type FriendLists = {
  friends: Friend[]
  /** Requests other people sent you. */
  incoming: Friend[]
  /** Requests you sent that nobody has answered yet. */
  outgoing: Friend[]
}

export type ChatMessage = {
  id: string
  senderId: string
  body: string
  createdAt: string
}

export interface SocialBackend {
  listFriends(): Promise<FriendLists>
  /** Throws ApiError: 404 no such user, 400 yourself, 409 already friends or requested. */
  sendRequest(username: string): Promise<void>
  respond(friendshipId: string, accept: boolean): Promise<void>
  removeFriend(friendshipId: string): Promise<void>
  /** The latest messages with a friend, oldest first. */
  getMessages(friendId: string): Promise<ChatMessage[]>
  sendMessage(friendId: string, body: string): Promise<ChatMessage>
}
