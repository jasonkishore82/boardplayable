// Types for the plain-JSX One Card table (Table.jsx).
import type { ComponentType } from 'react'
import type { Card, OneCardState } from './rules'

export const SUIT_COLORS: string[]

export type TableProps = {
  state: OneCardState
  /** Your hand (player 0), in the order to fan it. */
  mine: Card[]
  /** Ids of the cards you may play right now. */
  playableIds: Set<number>
  myTurn: boolean
  onPlay: (cardId: number) => void
  onDraw: () => void
  /** Catch a player who forgot to call One. */
  onCatch: (player: number) => void
  brand?: string
  sound?: boolean
}

declare const Table: ComponentType<TableProps>
export default Table
