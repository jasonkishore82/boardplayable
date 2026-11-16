// Types for the plain-JSX arena (Arena.jsx).
import type { ComponentType, RefObject } from 'react'
import type { Match, MatchEvent } from './game/match'

declare const Arena: ComponentType<{
  match: RefObject<Match | null>
  onEvents?: (events: MatchEvent[]) => void
  aimVisible: RefObject<boolean>
  paused?: boolean
  sound?: boolean
}>
export default Arena
