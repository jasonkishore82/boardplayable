import type { ReactNode } from 'react'

// Small line drawings, one per game. Drawn on a 48-unit grid with a 1.5 stroke.

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const glyphs: Record<string, ReactNode> = {
  chess: (
    <g {...common}>
      <rect x="8" y="8" width="32" height="32" rx="3" />
      <path d="M8 24h32M24 8v32" />
      <rect x="8" y="8" width="16" height="16" fill="currentColor" stroke="none" opacity="0.14" />
      <rect x="24" y="24" width="16" height="16" fill="currentColor" stroke="none" opacity="0.14" />
    </g>
  ),
  battleship: (
    <g {...common}>
      <rect x="8" y="8" width="32" height="32" rx="3" />
      <path d="M8 18.7h32M8 29.3h32M18.7 8v32M29.3 8v32" opacity="0.45" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
      <path d="M31.5 31.5l5 5M36.5 31.5l-5 5" />
    </g>
  ),
  'snakes-and-ladders': (
    <g {...common}>
      <rect x="8" y="8" width="32" height="32" rx="3" />
      <path d="M15 36V14M23 36V14M15 20h8M15 27h8M15 33h8" />
      <path d="M33 13c-4 3 4 6 0 9s4 6 0 9-2 5-2 5" />
    </g>
  ),
  'tic-tac-toe': (
    <g {...common}>
      <path d="M19 9v30M29 9v30M9 19h30M9 29h30" />
      <path d="M11.5 11.5l5 5M16.5 11.5l-5 5" />
      <circle cx="34" cy="34" r="2.75" />
    </g>
  ),
  cards: (
    <g {...common}>
      <rect x="12" y="12" width="18" height="26" rx="2.5" transform="rotate(-8 21 25)" />
      <rect x="19" y="10" width="18" height="26" rx="2.5" fill="var(--surface)" />
      <path d="M28 20l2.5 3-2.5 3-2.5-3z" />
    </g>
  ),
}

const fallback = (
  <g {...common}>
    <rect x="8" y="8" width="32" height="32" rx="3" />
  </g>
)

export function GameGlyph({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {glyphs[id] ?? fallback}
    </svg>
  )
}
