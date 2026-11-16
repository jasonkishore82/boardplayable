import type { ComponentType } from 'react'

// Props every game engine receives when it mounts.
export type GameEngineProps = {
  gameId: string
  /** Live room the player joined, when playing online. */
  roomId?: string
  /** Computer opponent to play, e.g. 'easy', 'medium' or 'jkw'. Only used when starting a room. */
  bot?: string
  /** The side the player asked for in the lobby ("white" or "black" in chess). Only used when taking a seat. */
  seat?: string
}

type EngineModule = { default: ComponentType<GameEngineProps> }

// Game engines, loaded on demand so each one ships in its own chunk.
// To add one: create src/games/engines/<id>/index.tsx with a default export,
// register it below, and set its status to 'available' in catalog.ts.
export const engines: Record<string, () => Promise<EngineModule>> = {
  chess: () => import('./engines/chess'),
  'tic-tac-toe': () => import('./engines/tic-tac-toe'),
  cricket: () => import('./engines/cricket'),
  'free-flight': () => import('./engines/free-flight'),
  'free-fly': () => import('./engines/free-fly'),
  bowling: () => import('./engines/bowling'),
  badminton: () => import('./engines/badminton'),
}
