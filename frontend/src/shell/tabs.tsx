import type { ReactNode } from 'react'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export type Tab = { to: string; label: string; icon: ReactNode }

export const TABS: Tab[] = [
  {
    to: '/games',
    label: 'Games',
    icon: (
      <g {...stroke}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </g>
    ),
  },
  {
    to: '/friends',
    label: 'Friends',
    icon: (
      <g {...stroke}>
        <circle cx="9" cy="9" r="3.25" />
        <path d="M3.5 19.5c.6-3 2.8-4.75 5.5-4.75s4.9 1.75 5.5 4.75" />
        <circle cx="16.5" cy="8" r="2.5" />
        <path d="M16.5 13c2.2 0 3.7 1.4 4.2 3.8" />
      </g>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <g {...stroke}>
        <circle cx="12" cy="8.5" r="3.75" />
        <path d="M5 20c.8-3.6 3.6-5.75 7-5.75s6.2 2.15 7 5.75" />
      </g>
    ),
  },
]
