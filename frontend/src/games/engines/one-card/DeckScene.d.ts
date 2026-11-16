// Types for the plain-JSX card deck scene (DeckScene.jsx).
import type { ComponentType } from 'react'

export type DeckSceneProps = {
  /** "hand": a fanned hand of seven with a Deal button. "single": one card that tilts towards the pointer. */
  layout?: 'hand' | 'single'
  background?: string
  autoRotate?: boolean
  /** For layout "single": the card ('0'-'9', 'skip', 'reverse', '+2', 'wild', '+4') and its suit (1-4). */
  card?: string
  suit?: number
  /** The wordmark on the card backs, up to 8 letters. */
  brand?: string
  /** The four suit colours; the back uses the first two. */
  color1?: string
  color2?: string
  color3?: string
  color4?: string
  sound?: boolean
}

declare const DeckScene: ComponentType<DeckSceneProps>
export default DeckScene
