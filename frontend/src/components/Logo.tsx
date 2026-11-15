// Logo concept: a rounded tile holding four pieces — two stacked counters on
// the left, a ringed counter top-right, and an "L" with a curved hypotenuse.
// `glossy` (the default) has shaded colours, a light reflection on each counter and a shine across the tile.
// `matte` is a flat, no-gloss colour fill; `outline` follows currentColor.
// Hover the logo and the ringed counter rolls down the slope (see Logo.module.css).

import { useId, useState } from 'react'
import styles from './Logo.module.css'

type LogoProps = {
  size?: number
  variant?: 'glossy' | 'matte' | 'outline'
  strokeWidth?: number // outline only
  title?: string
  className?: string
  /** Roll the ring down the slope. Leave it out and the logo rolls when the pointer is over it. */
  rolling?: boolean
}

// Muted, low-saturation tones. The matte variant uses them as flat fills; the glossy one shades them.
export const MATTE = {
  tile: '#2a2c31', // charcoal
  coral: '#c9785d', // terracotta
  sage: '#84a08f',
  ochre: '#d6a85c',
  bone: '#e6dfd1',
}

const STEM = 'M367 220 V509 H520'
const CURVE = 'M520 509 C470 488 424 466 408 410 C394 360 376 290 367 220'
const L_FILL = `${STEM} ${CURVE.replace('M520 509', '')} Z`

// The ringed counter as one shape with a real hole, so what is behind it shows through.
const RING = 'M367 220a88 88 0 1 0 176 0a88 88 0 1 0-176 0ZM412 217a43 43 0 1 0 86 0a43 43 0 1 0-86 0Z'

// The shine across the top of the tile: the tile's top half with a curved lower edge.
const SHEEN = 'M80 127A82 82 0 0 1 162 45H514A82 82 0 0 1 596 127V250Q338 330 80 250Z'

export function Logo({ size = 48, variant = 'glossy', strokeWidth = 3.5, title, className, rolling }: LogoProps) {
  // null until the first hover, so the logo sits still on load. Then 'down' while hovered and 'up' after.
  const [hovered, setHovered] = useState<boolean | null>(null)
  const active = rolling ?? hovered
  const ringClass = [styles.ring, active === true && styles.down, active === false && styles.up]
    .filter(Boolean)
    .join(' ')
  const hover =
    rolling === undefined ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {}

  // Gradient ids have to be unique on the page, because the logo can appear more than once.
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${uid}-${name}`
  const ref = (name: string) => `url(#${id(name)})`

  const a11y = {
    role: title ? 'img' : undefined,
    'aria-hidden': title ? undefined : true,
    'aria-label': title,
  } as const

  if (variant === 'outline') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="74 39 528 532"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...hover}
        {...a11y}
      >
        <rect x="80" y="45" width="516" height="520" rx="82" />
        <circle cx="238" cy="228" r="70" />
        <circle cx="234" cy="428" r="89" />
        <g className={ringClass}>
          <circle cx="455" cy="220" r="88" />
          <circle cx="455" cy="217" r="43" />
        </g>
        <path d={STEM} />
        <path d={CURVE} />
      </svg>
    )
  }

  if (variant === 'matte') {
    return (
      <svg width={size} height={size} viewBox="74 39 528 532" className={className} {...hover} {...a11y}>
        <rect x="80" y="45" width="516" height="520" rx="82" fill={MATTE.tile} />
        <circle cx="238" cy="228" r="70" fill={MATTE.coral} />
        <circle cx="234" cy="428" r="89" fill={MATTE.sage} />
        <g className={ringClass}>
          <circle cx="455" cy="220" r="88" fill={MATTE.ochre} />
          <circle cx="455" cy="217" r="43" fill={MATTE.tile} />
        </g>
        <path d={L_FILL} fill={MATTE.bone} />
      </svg>
    )
  }

  // A light reflection near the top left of a counter, in the counter's own drawing units.
  const shine = (cx: number, cy: number, r: number, key: string) => (
    <ellipse
      key={key}
      cx={cx - r * 0.34}
      cy={cy - r * 0.52}
      rx={r * 0.46}
      ry={r * 0.22}
      transform={`rotate(-32 ${cx - r * 0.34} ${cy - r * 0.52})`}
      fill={ref('spec')}
    />
  )

  return (
    <svg width={size} height={size} viewBox="74 39 528 532" className={className} {...hover} {...a11y}>
      <defs>
        <linearGradient id={id('tile')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#30333a" />
          <stop offset="0.55" stopColor="#2a2c31" />
          <stop offset="1" stopColor="#232529" />
        </linearGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('spec')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('coral')} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#d58e75" />
          <stop offset="0.6" stopColor="#c9785d" />
          <stop offset="1" stopColor="#b86a50" />
        </radialGradient>
        <radialGradient id={id('sage')} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#93af9e" />
          <stop offset="0.6" stopColor="#84a08f" />
          <stop offset="1" stopColor="#73907f" />
        </radialGradient>
        <radialGradient id={id('ochre')} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#e2b86f" />
          <stop offset="0.6" stopColor="#d6a85c" />
          <stop offset="1" stopColor="#c4964c" />
        </radialGradient>
        <linearGradient id={id('bone')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eee8da" />
          <stop offset="0.6" stopColor="#e6dfd1" />
          <stop offset="1" stopColor="#d6cebd" />
        </linearGradient>
      </defs>

      <rect x="80" y="45" width="516" height="520" rx="82" fill={ref('tile')} />
      <rect x="82" y="47" width="512" height="516" rx="80" fill="none" stroke={ref('rim')} strokeWidth="3" />

      <circle cx="238" cy="228" r="70" fill={ref('coral')} />
      {shine(238, 228, 70, 'coral')}
      <circle cx="234" cy="428" r="89" fill={ref('sage')} />
      {shine(234, 428, 89, 'sage')}
      <g className={ringClass}>
        <path d={RING} fill={ref('ochre')} fillRule="evenodd" />
        {shine(455, 220, 88, 'ring')}
      </g>
      <path d={L_FILL} fill={ref('bone')} />

      <path d={SHEEN} fill={ref('sheen')} />
    </svg>
  )
}
