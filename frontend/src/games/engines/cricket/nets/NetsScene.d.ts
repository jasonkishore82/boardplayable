// Types for the plain-JSX nets scene (NetsScene.jsx).
import type { ComponentType, RefObject } from 'react'
import type { Delivery, Pace } from './shot'

export type NetsView = 'batter' | 'side' | 'stumps' | 'machine'

/** The bat's controls: x across the crease, y the swing (+1 backlift, -1 follow-through), each -1..1. With a phone,
 *  q is its turn since it was centred ([x, y, z, w] in the bat's frame) and the bat follows it freely instead. */
export type BatInput = {
  x: number
  y: number
  auto: number
  q?: [number, number, number, number] | null
  /** With the webcam on: how far it has seen the hands move since centring (metres, world axes). */
  hands?: { x: number; y: number; z: number } | null
}

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
