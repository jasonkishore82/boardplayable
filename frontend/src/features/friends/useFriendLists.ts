import { useCallback, useEffect, useState } from 'react'
import { social } from '../../lib/social'
import type { FriendLists } from '../../lib/socialTypes'

const REFRESH_MS = 8000

// The friend list, requests and who is waiting on you. Refreshes itself so new requests show up.
export function useFriendLists() {
  const [lists, setLists] = useState<FriendLists | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!social) return
    try {
      setLists(await social.listFriends())
      setError('')
    } catch {
      setError('Couldn’t load your friends. Try again in a moment.')
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  return { lists, error, reload }
}
