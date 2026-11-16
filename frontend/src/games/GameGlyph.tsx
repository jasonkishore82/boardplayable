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
  warship: (
    <g {...common}>
      <rect x="8" y="8" width="32" height="32" rx="3" />
      <path d="M8 18.7h32M8 29.3h32M18.7 8v32M29.3 8v32" opacity="0.45" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
      <path d="M31.5 31.5l5 5M36.5 31.5l-5 5" />
    </g>
  ),
  'snakes-and-ladders': (
    <g {...common}>
      <path d="M12 40L20 8M22 40L30 8M14.2 31h8M16.4 22h8M18.6 13h8" />
      <path d="M40 10c-6 0-6 6-1 8s5 8-2 9-7 7-1 9" />
      <circle cx="40" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </g>
  ),
  'game-of-life': (
    <g {...common}>
      <circle cx="24" cy="24" r="15" />
      <path d="M24 9v30M9 24h30M13.4 13.4l21.2 21.2M34.6 13.4L13.4 34.6" opacity="0.45" />
      <path d="M24 24l7-10" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
    </g>
  ),
  'one-card': (
    <g {...common}>
      <rect x="9" y="12" width="18" height="26" rx="3" transform="rotate(-12 18 25)" opacity="0.45" />
      <rect x="18" y="10" width="20" height="28" rx="3" transform="rotate(8 28 24)" />
      <path d="M27 20l3-2v12" transform="rotate(8 28 24)" />
    </g>
  ),
  cricket: (
    <g {...common}>
      <path d="M30.5 9.5l4 4-15 15-4-4z" />
      <path d="M17.5 26.5l-7 7a2 2 0 002.8 2.8l7-7" />
      <circle cx="35" cy="34" r="4" />
      <path d="M32.2 31.2c1.6 1.6 1.6 4.2 0 5.6" opacity="0.45" />
    </g>
  ),
  'tic-tac-toe': (
    <g {...common}>
      <path d="M19 9v30M29 9v30M9 19h30M9 29h30" />
      <path d="M11.5 11.5l5 5M16.5 11.5l-5 5" />
      <circle cx="34" cy="34" r="2.75" />
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
