// Types for the plain-JSX face board scene (FaceBoardScene.jsx).
import type { ComponentType } from 'react'

export type FaceBoardSceneProps = {
  /** Frames per side: 1-5 rows, 2-10 columns. */
  rows?: number
  cols?: number
  autoRotate?: boolean
  /** Name strips under the faces. */
  labels?: boolean
  trayColor?: string
  frameColor?: string
  /** Plastic clacks when a frame falls or snaps back up. */
  sound?: boolean
}

declare const FaceBoardScene: ComponentType<FaceBoardSceneProps>
export default FaceBoardScene
