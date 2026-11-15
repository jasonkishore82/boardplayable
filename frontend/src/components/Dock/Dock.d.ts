// Types for Dock.jsx, the React Bits dock. The component itself is plain JavaScript, so this file is what
// TypeScript reads when something imports './Dock'.
import type { CSSProperties, ReactNode } from 'react'

export type DockMenuRow = {
  label?: ReactNode
  icon?: ReactNode
  shortcut?: string
  checked?: boolean
  disabled?: boolean
  separator?: boolean
  onClick?: () => void
  items?: DockMenuRow[]
}

export type DockItem = {
  icon?: ReactNode
  label?: string
  /** Draws a small dot under the icon. */
  active?: boolean
  badge?: number | string | boolean
  className?: string
  separator?: boolean
  onClick?: () => void
  /** Opens on right-click or press and hold. */
  menu?: DockMenuRow[]
}

export type DockProps = {
  items?: DockItem[]
  position?: 'bottom' | 'top' | 'left' | 'right'
  theme?: 'dark' | 'light'
  baseItemSize?: number
  magnification?: number
  distance?: number
  panelHeight?: number
  gap?: number
  roundness?: number
  spring?: { mass?: number; stiffness?: number; damping?: number }
  bounce?: boolean
  autoHide?: boolean
  tiles?: boolean
  showLabels?: boolean
  showIndicators?: boolean
  showBadges?: boolean
  badgeColor?: string
  accentColor?: string
  className?: string
  style?: CSSProperties
}

export default function Dock(props: DockProps): ReactNode
