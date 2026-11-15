import { useId } from 'react'

// The BP monogram: a B (two red bowls, left) and a P (one purple bowl, right) sharing one upright stem.
// Each bowl is a crescent, thick on its outer edge and tapering to a hairline where it meets the stem, like a
// broad-nib stroke. The stem is split down the middle, red on the B side and purple on the P side.
//
// Geometry (drawing units): stem at x = 100 from y = 20 to 250. Top bowls: circle (100, 80) r 60, both halves.
// B's lower bowl: circle (100, 195) r 55, left half only, meeting the top bowl at the stem at y = 140.
// Each crescent's inner circle is shifted toward the stem, so the stroke is ~18 units at its widest and ~14 at the stem.
// The stem is two 7-unit bars, the B's and the P's, with a small gap between them.

const P_BOWL = 'M100 20A60 60 0 0 1 100 140L100 125.83A46 46 0 0 0 100 34.17Z'
const B_TOP = 'M100 20A60 60 0 0 0 100 140L100 125.83A46 46 0 0 1 100 34.17Z'
/** The space between the B's half of the stem and the P's. */
const GAP = 6

const B_LOW = 'M100 140A55 55 0 0 0 100 250L100 236.81A42 42 0 0 1 100 153.19Z'

type Props = {
  size?: number
  /** Draw it on a dark rounded tile, for app icons and favicons. */
  tile?: boolean
  title?: string
  className?: string
}

export function Monogram({ size = 48, tile = false, title, className }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${uid}-${name}`
  const url = (name: string) => `url(#${id(name)})`
  const a11y = title ? ({ role: 'img', 'aria-label': title } as const) : ({ 'aria-hidden': true } as const)

  return (
    <svg
      width={tile ? size : (size * 144) / 244}
      height={size}
      viewBox={tile ? '-49 -14 298 298' : '28 13 144 244'}
      className={className}
      {...a11y}
    >
      <defs>
        <linearGradient id={id('red')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ff5a6e" />
          <stop offset="1" stopColor="#e3123f" />
        </linearGradient>
        <linearGradient id={id('purple')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#b57cff" />
          <stop offset="1" stopColor="#7433d6" />
        </linearGradient>
        <linearGradient id={id('tile')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262a36" />
          <stop offset="1" stopColor="#15171f" />
        </linearGradient>
      </defs>

      {tile && <rect x="-45" y="-10" width="290" height="290" rx="64" fill={url('tile')} />}

      {/* The B (red) and the P (purple) each have their own half of the stem, pulled apart by a small gap. */}
      <g transform={`translate(${-GAP / 2} 0)`}>
        <path d={B_TOP} fill={url('red')} />
        <path d={B_LOW} fill={url('red')} />
        <rect x="93" y="20" width="7" height="230" rx="3.5" fill={url('red')} />
      </g>
      <g transform={`translate(${GAP / 2} 0)`}>
        <path d={P_BOWL} fill={url('purple')} />
        <rect x="100" y="20" width="7" height="230" rx="3.5" fill={url('purple')} />
      </g>
    </svg>
  )
}
