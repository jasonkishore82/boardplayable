// Types for the plain-JSX nets scene (NetsScene.jsx).
import type { ComponentType, RefObject } from 'react'
import type { Delivery, Pace } from './shot'

export type NetsView = 'batter' | 'side' | 'machine'

/** The bat's controls: x across the crease, y the swing (+1 backlift, -1 follow-through), each -1..1. */
export type BatInput = { x: number; y: number; auto: number }

export type NetsSceneProps = {
  view: NetsView
  pace: Pace
  /** Bump to bowl the next ball. */
  bowl: number
  input: RefObject<BatInput>
  sound?: boolean
  onLaunch?: () => void
  onContact?: (speed: number) => void
  onDelivery?: (result: Delivery) => void
  onReport?: (report: { kmh: number; rpm: number; fired: number }) => void
}

declare const NetsScene: ComponentType<NetsSceneProps>
export default NetsScene
