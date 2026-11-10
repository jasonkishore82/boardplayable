import type { ComponentType } from 'react'

// Props every game engine receives when it mounts.
export type GameEngineProps = {
  gameId: string
  /** Live room the player joined, when playing online. */
  roomId?: string
}

type EngineModule = { default: ComponentType<GameEngineProps> }

// Game engines, loaded on demand so each one ships in its own chunk.
// To add one: create src/games/engines/<id>/index.tsx with a default export,
// register it below, and set its status to 'available' in catalog.ts.
export const engines: Record<string, () => Promise<EngineModule>> = {
  'tic-tac-toe': () => import('./engines/tic-tac-toe'),
}
