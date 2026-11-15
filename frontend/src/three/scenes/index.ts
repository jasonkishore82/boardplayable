import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { SceneProps } from './shared'

export type { SceneMode, SceneProps } from './shared'

// The games that have a 3D board. Each scene loads on demand, so the 3D code is only downloaded when someone opens it.
// To give another game a 3D view: add its scene here, and wrap its flat board in <BoardSlot>.
export const scenes: Record<string, LazyExoticComponent<ComponentType<SceneProps>>> = {
  chess: lazy(() => import('./ChessScene')),
  'tic-tac-toe': lazy(() => import('./TicTacToeScene')),
}

export const hasScene = (gameId: string): boolean => gameId in scenes
