// Types for the plain-JSX roulette table scene (RouletteScene.jsx).
import type { ComponentType } from 'react'

export type RouletteSceneProps = {
  feltColor?: string
  woodColor?: string
  leatherColor?: string
  metalColor?: string
  /** Chips on the cloth and a balance; off, the wheel just spins. */
  betting?: boolean
  sound?: boolean
  /** Dimension callouts round the table. */
  dimensions?: boolean
  ambientOcclusion?: boolean
  autoRotate?: boolean
  /** The camera view to start on, e.g. 'Front-L', 'Top' or 'Wheel'. */
  view?: string
}

declare const RouletteScene: ComponentType<RouletteSceneProps>
export default RouletteScene
