// Types for the plain-JSX alley scene (Alley.jsx).
import type { ForwardRefExoticComponent, RefAttributes, RefObject } from 'react'
import type { Throw } from './lane'
import type { FrameView } from './score'

export const LANES: number
export function laneX(i: number): number

export type Aim = { x: number; angle: number; visible: boolean }

export type TvData = {
  lane: number
  name: string
  idle: boolean
  up: boolean
  done: boolean
  frames: FrameView[]
  total: number
  frame: number
  pins: boolean[] | null
  message: { title: string; tone: string; detail?: string } | null
}

export type AlleyApi = {
  bowl: (lane: number, t: Throw) => void
  sweep: (lane: number, freshRack: boolean) => boolean[]
  standing: (lane: number) => boolean[]
  reset: () => void
}

export type AlleyProps = {
  active: number
  aim: RefObject<Aim>
  tvs: TvData[]
  sound?: boolean
  view?: 'auto' | 'pins'
  onSettled?: (lane: number, standing: boolean[]) => void
}

declare const Alley: ForwardRefExoticComponent<AlleyProps & RefAttributes<AlleyApi>>
export default Alley
