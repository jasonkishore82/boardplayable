import { useSyncExternalStore } from 'react'

// The games a player has finished, newest first. Kept on this device (per signed-in user), like the theme and backdrop.

export type Result = 'won' | 'lost' | 'draw'

export type PlayedGame = {
  id: string
  gameId: string
  title: string
  opponent: string
  result: Result
  /** When the game ended, as a timestamp in milliseconds. */
  at: number
  /** How many moves were played. */
  moves: number
}

const LIMIT = 200
const listeners = new Set<() => void>()
const cache = new Map<string, PlayedGame[]>()
const EMPTY: PlayedGame[] = []

const keyOf = (userId: string) => `history:${userId}`

function load(userId: string): PlayedGame[] {
  const cached = cache.get(userId)
  if (cached) return cached
  let list: PlayedGame[] = EMPTY
  try {
    const parsed = JSON.parse(localStorage.getItem(keyOf(userId)) ?? '[]')
    if (Array.isArray(parsed)) list = parsed
  } catch {
    // Storage blocked or damaged: start with an empty list.
  }
  cache.set(userId, list)
  return list
}

/** Adds a finished game. A game with the same id is only recorded once. */
export function recordGame(userId: string, game: PlayedGame): void {
  const current = load(userId)
  if (current.some((g) => g.id === game.id)) return
  const next = [game, ...current].slice(0, LIMIT)
  cache.set(userId, next)
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(next))
  } catch {
    // The list still shows for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useGameHistory(userId: string | undefined): PlayedGame[] {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? load(userId) : EMPTY),
    () => EMPTY,
  )
}
