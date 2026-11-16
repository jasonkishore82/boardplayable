import { useId, type ReactNode } from 'react'

// Small colourful illustrations, one per game, drawn on a 48-unit grid. Gradient ids are prefixed per instance
// (useId), so many icons can sit on one page without their gradients clashing.

type Ref = (name: string) => string
type Glyph = (url: Ref, id: Ref) => ReactNode

/** A top-to-bottom gradient. */
const lin = (id: string, from: string, to: string, x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={from} />
    <stop offset="1" stopColor={to} />
  </linearGradient>
)
const rad = (id: string, from: string, to: string, cx = 0.35, cy = 0.3) => (
  <radialGradient id={id} cx={cx} cy={cy} r="0.75">
    <stop offset="0" stopColor={from} />
    <stop offset="1" stopColor={to} />
  </radialGradient>
)

/** A pie wedge from angle a0 to a1 (degrees, 0 = up, clockwise). */
function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`
  }
  return `M${cx} ${cy}L${p(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}Z`
}

const glyphs: Record<string, Glyph> = {
  chess: (url, id) => (
    <>
      <defs>
        {lin(id('frame'), '#c98a4b', '#7a4520')}
        {lin(id('pawn'), '#ffffff', '#cfd6e4')}
      </defs>
      <rect x="5" y="5" width="38" height="38" rx="6" fill={url('frame')} />
      <rect x="9" y="9" width="30" height="30" rx="2" fill="#f3e2c0" />
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3]
          .filter((c) => (r + c) % 2 === 1)
          .map((c) => <rect key={`${r}${c}`} x={9 + c * 7.5} y={9 + r * 7.5} width="7.5" height="7.5" fill="#6b3b1c" />),
      )}
      <ellipse cx="24" cy="35.5" rx="8" ry="2" fill="#000" opacity="0.25" />
      <path d="M17 35h14l-2-3.5h-2.3L25.5 24h-3l-1.2 7.5H19z" fill={url('pawn')} stroke="#1e2433" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="24" cy="20.5" r="4" fill={url('pawn')} stroke="#1e2433" strokeWidth="1" />
    </>
  ),
  'tic-tac-toe': (url, id) => (
    <>
      <defs>{lin(id('bg'), '#7b5cff', '#4a2fc4')}</defs>
      <rect x="5" y="5" width="38" height="38" rx="9" fill={url('bg')} />
      <path d="M19 10v28M29 10v28M10 19h28M10 29h28" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
      <path d="M11.5 11.5l5 5M16.5 11.5l-5 5M31.5 21.5l5 5M36.5 21.5l-5 5" stroke="#ff5fa2" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.8" fill="none" stroke="#3ee6d0" strokeWidth="2.4" />
      <circle cx="14" cy="34" r="2.8" fill="none" stroke="#3ee6d0" strokeWidth="2.4" />
      <path d="M31.5 31.5l5 5M36.5 31.5l-5 5" stroke="#ff5fa2" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  'free-flight': (url, id) => (
    <>
      <defs>
        {lin(id('sky'), '#5d87c9', '#f2b48c')}
        {lin(id('sea'), '#2b6cb0', '#123a63')}
        {lin(id('wing'), '#ffb36b', '#ff7a45', 1, 1)}
      </defs>
      <rect x="5" y="5" width="38" height="38" rx="9" fill={url('sky')} />
      <circle cx="33" cy="30" r="6" fill="#ffe3a3" opacity="0.9" />
      <path d="M5 32h38v2a9 9 0 0 1-9 9H14a9 9 0 0 1-9-9z" fill={url('sea')} />
      <path d="M8 35.5h8M22 38h10M30 34.5h7" stroke="#bfe2ff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 26c6-4 14-7 24-12" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="2 2.5" strokeLinecap="round" />
      <g transform="rotate(-24 27 18)">
        <path d="M14 18.5l22-2.5a2.2 2.2 0 0 1 0 4.4L14 19.5z" fill="#fff" />
        <path d="M24 18l-6-8h3.5l9 7.7zM24 19.4l-6 8h3.5l9-7.6z" fill={url('wing')} />
        <path d="M14.5 18.8l-3-4.3h2.6l3.6 3.9z" fill={url('wing')} />
        <circle cx="33" cy="18.1" r="1" fill="#2b6cb0" />
      </g>
    </>
  ),
  'free-fly': (url, id) => (
    <>
      <defs>
        {lin(id('sky'), '#2f6fd0', '#cfe2f4')}
        {lin(id('rock'), '#8c6545', '#4a3022')}
        {lin(id('wing'), '#7fe0ff', '#2f8fe0', 1, 1)}
      </defs>
      <rect x="5" y="5" width="38" height="38" rx="9" fill={url('sky')} />
      <path d="M5 37h38v-1a6 6 0 0 0-6-5c-3 0-4 2-7 2s-4-3-8-3-5 3-8 3-4-2-9 1z" fill="#fff" opacity="0.9" />
      <path d="M8 21h11l-2 3-3.5 7-2-6z" fill={url('rock')} />
      <path d="M7.5 20.6h12v1.6h-12z" fill="#67b04a" />
      <path d="M28 27h9l-1.6 2.5-2.9 5-1.6-4.5z" fill={url('rock')} />
      <path d="M27.6 26.6h9.8v1.4h-9.8z" fill="#67b04a" />
      <g transform="rotate(-18 27 16)">
        <path d="M17 16.5l18-1.8a1.8 1.8 0 0 1 0 3.6L17 17.5z" fill="#fff" />
        <path d="M25 16l-5-6.5h3l7.5 6.3zM25 17.3l-5 6.5h3l7.5-6.2z" fill={url('wing')} />
        <circle cx="16.8" cy="17" r="1.6" fill="#5ad1ff" />
      </g>
    </>
  ),
  warship: (url, id) => (
    <>
      <defs>
        {lin(id('sea'), '#2fb7ff', '#0b5fb8')}
        {lin(id('hull'), '#d9dee6', '#7d8796')}
      </defs>
      <rect x="5" y="5" width="38" height="38" rx="6" fill={url('sea')} />
      <path d="M5 17.7h38M5 30.3h38M17.7 5v38M30.3 5v38" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
      <path d="M9 25h22l-3 5H12z" fill={url('hull')} />
      <rect x="15" y="21" width="9" height="4" rx="1" fill="#aeb6c2" />
      <rect x="18" y="17.5" width="2" height="4" fill="#5b6472" />
      <circle cx="36" cy="12" r="4.5" fill="#ffd166" opacity="0.35" />
      <path d="M33.5 9.5l5 5M38.5 9.5l-5 5" stroke="#ff3b4e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 35c3-1.5 5 1.5 8 0s5 1.5 8 0 5 1.5 8 0 5 1.5 8 0" fill="none" stroke="#bfe9ff" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  'snakes-and-ladders': (url, id) => (
    <>
      <defs>
        {lin(id('bg'), '#7ee081', '#2e9d5b')}
        {lin(id('snake'), '#ffd23f', '#ff7a1a', 1, 1)}
      </defs>
      <rect x="5" y="5" width="38" height="38" rx="6" fill={url('bg')} />
      <path d="M12 40L19 8M21 40L28 8M14 31h8.2M16 22h8.2M18 13h8.2" stroke="#8b5a2b" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M38 11c-6 0-6 6-1 8s5 8-2 9-7 7-1 9" fill="none" stroke={url('snake')} strokeWidth="4" strokeLinecap="round" />
      <circle cx="38.5" cy="11" r="3" fill="#ff7a1a" />
      <circle cx="39.3" cy="10.2" r="0.8" fill="#1b1b1b" />
    </>
  ),
  'game-of-life': (url, id) => {
    const colors = ['#ff4d6d', '#ff9f1c', '#ffd23f', '#5ee35a', '#2ec4ff', '#4361ee', '#9d4edd', '#f15bb5']
    return (
      <>
        <defs>{rad(id('hub'), '#ffffff', '#d4d8e0')}</defs>
        <circle cx="24" cy="25" r="18" fill="#000" opacity="0.2" />
        {colors.map((c, i) => (
          <path key={c} d={wedge(24, 24, 18, i * 45, (i + 1) * 45)} fill={c} />
        ))}
        <circle cx="24" cy="24" r="18" fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="24" cy="24" r="5" fill={url('hub')} />
        <path d="M24 2.5l3 5.5h-6z" fill="#fff" stroke="#1e2433" strokeWidth="1" strokeLinejoin="round" />
      </>
    )
  },
  'one-card': (url, id) => (
    <>
      <defs>
        {lin(id('back'), '#ff4d6d', '#b5179e', 1, 1)}
        {lin(id('front'), '#ffe066', '#ffb703', 1, 1)}
      </defs>
      <rect x="7" y="11" width="20" height="28" rx="3.5" transform="rotate(-14 17 25)" fill={url('back')} stroke="#fff" strokeWidth="1.5" />
      <rect x="19" y="9" width="21" height="30" rx="3.5" transform="rotate(8 29.5 24)" fill={url('front')} stroke="#fff" strokeWidth="1.5" />
      <g transform="rotate(8 29.5 24)">
        <ellipse cx="29.5" cy="24" rx="7" ry="10" fill="#fff" opacity="0.55" transform="rotate(25 29.5 24)" />
        <path d="M27 20.5l3.5-2.5v12.5" fill="none" stroke="#d62828" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),
  roulette: (url, id) => (
    <>
      <defs>
        {lin(id('rim'), '#b5793f', '#5e3412')}
        {rad(id('cone'), '#ffe8a3', '#c99a2e')}
      </defs>
      <circle cx="24" cy="24" r="20" fill={url('rim')} />
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={wedge(24, 24, 16, i * 22.5, (i + 1) * 22.5)} fill={i === 0 ? '#1fae5b' : i % 2 ? '#d62839' : '#1b1b1f'} />
      ))}
      <circle cx="24" cy="24" r="16" fill="none" stroke="#e9c46a" strokeWidth="1" />
      <circle cx="24" cy="24" r="8" fill={url('cone')} stroke="#8a5a1c" strokeWidth="1" />
      <path d="M24 18.5v11M18.5 24h11" stroke="#8a5a1c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="24" r="1.8" fill="#8a5a1c" />
      <circle cx="33.5" cy="12.5" r="2.4" fill="#fff" stroke="#c9ced8" strokeWidth="0.6" />
    </>
  ),
  poker: (url, id) => (
    <>
      <defs>
        {rad(id('chip'), '#ff6b6b', '#b3122a')}
        {lin(id('card'), '#ffffff', '#e3e7ef')}
      </defs>
      <rect x="20" y="5" width="18" height="25" rx="3" transform="rotate(14 29 17.5)" fill={url('card')} stroke="#c3c9d4" strokeWidth="1" />
      <path d="M31 10.5l2.4 3.4-2.4 3.4-2.4-3.4z" fill="#e63946" transform="rotate(14 29 17.5)" />
      <circle cx="21" cy="28" r="15" fill={url('chip')} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="19" y="13" width="4" height="5" rx="1" fill="#fff" transform={`rotate(${i * 45} 21 28)`} />
      ))}
      <circle cx="21" cy="28" r="9" fill="#fff" />
      <circle cx="21" cy="28" r="9" fill="none" stroke="#e9c46a" strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M21 22.5c-2.8 3.2-5 4.4-5 6.6a2.5 2.5 0 0 0 4.2 1.8L19.4 33.5h3.2l-.8-2.6a2.5 2.5 0 0 0 4.2-1.8c0-2.2-2.2-3.4-5-6.6z" fill="#1b1b1f" />
    </>
  ),
  bowling: (url, id) => (
    <>
      <defs>
        {lin(id('pin'), '#ffffff', '#d9dde5', 1, 0)}
        {rad(id('ball'), '#7fb3ff', '#2340b8')}
      </defs>
      <path d="M32 6c-2.3 0-3.2 2.1-3.2 4.2s1.6 3.6 1.6 5.6S27.5 20 27.5 27c0 6 1.6 10.5 4.5 12.5 2.9-2 4.5-6.5 4.5-12.5 0-7-2.9-9.2-2.9-11.2s1.6-3.5 1.6-5.6S34.3 6 32 6z" fill={url('pin')} stroke="#aab2c0" strokeWidth="0.8" />
      <path d="M29.2 14.5h5.6M29.6 17h4.8" stroke="#e63946" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="17" cy="41" rx="9" ry="1.8" fill="#000" opacity="0.25" />
      <circle cx="17" cy="31" r="10" fill={url('ball')} />
      <circle cx="14" cy="27.5" r="1.4" fill="#0d1b4c" />
      <circle cx="18.6" cy="26.8" r="1.4" fill="#0d1b4c" />
      <circle cx="16.8" cy="31" r="1.5" fill="#0d1b4c" />
      <path d="M11 26a7 7 0 0 1 4-3.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  cricket: (url, id) => (
    <>
      <defs>
        {lin(id('bat'), '#f6d7a0', '#c98d4a', 1, 0)}
        {rad(id('ball'), '#ff6b6b', '#a4161a')}
      </defs>
      <g transform="rotate(45 24 24)">
        <rect x="19" y="10" width="10" height="26" rx="4" fill={url('bat')} stroke="#9a6430" strokeWidth="0.8" />
        <path d="M24 13v20" stroke="#9a6430" strokeOpacity="0.4" strokeWidth="1" />
        <rect x="22.2" y="36" width="3.6" height="9" rx="1.5" fill="#22223b" />
        <path d="M22.2 38.5h3.6M22.2 41h3.6" stroke="#4a4e69" strokeWidth="0.9" />
      </g>
      <circle cx="35" cy="34" r="6" fill={url('ball')} />
      <path d="M31 30.2c2 2.2 2 5.4 0 7.6M33.4 29.1c2.2 2.8 2.2 7 0 9.8" fill="none" stroke="#fff" strokeWidth="0.9" strokeDasharray="1.2 1" />
    </>
  ),
  badminton: (url, id) => (
    <>
      <defs>
        {lin(id('feather'), '#ffffff', '#dfe6f2')}
        {rad(id('cork'), '#ff7b7b', '#c1121f', 0.4, 0.3)}
      </defs>
      <path d="M17 31L10 7.5c6-2.5 22-2.5 28 0L31 31z" fill={url('feather')} stroke="#b6c0d2" strokeWidth="1" strokeLinejoin="round" />
      <path d="M19.4 31L16 6.3M22.5 31L21.5 5.4M25.5 31L26.5 5.4M28.6 31L32 6.3" stroke="#b6c0d2" strokeWidth="0.9" />
      <path d="M12 15.5c8-1.5 16-1.5 24 0M14 23c6.5-1.2 13.5-1.2 20 0" fill="none" stroke="#3a86ff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 31h14v2a7 7 0 0 1-14 0z" fill={url('cork')} />
      <rect x="16.5" y="30" width="15" height="2.6" rx="1.3" fill="#ffd23f" />
    </>
  ),
  tennis: (url, id) => (
    <>
      <defs>{rad(id('ball'), '#f4ff7a', '#9ccc1c')}</defs>
      <ellipse cx="24" cy="42.5" rx="12" ry="2" fill="#000" opacity="0.2" />
      <circle cx="24" cy="23" r="17" fill={url('ball')} />
      <path d="M12.5 10.5c5 4 7 8 7 12.5s-2 8.5-7 12.5M35.5 10.5c-5 4-7 8-7 12.5s2 8.5 7 12.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 15a12 12 0 0 1 6-6" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  'table-tennis': (url, id) => (
    <>
      <defs>
        {rad(id('rubber'), '#ff6b6b', '#c1121f', 0.4, 0.35)}
        {lin(id('handle'), '#e6b17e', '#9c6233', 1, 0)}
        {rad(id('ball'), '#ffffff', '#ffb35c')}
      </defs>
      <path d="M27.5 29.5l9.5 9.5a2.6 2.6 0 0 1-3.7 3.7l-9.5-9.5z" fill={url('handle')} />
      <circle cx="19" cy="21" r="13" fill="#1b1b1f" />
      <circle cx="19" cy="21" r="12" fill={url('rubber')} />
      <path d="M11 14.5a10 10 0 0 1 6-4" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="37" cy="11" r="4.5" fill={url('ball')} stroke="#f08a24" strokeWidth="0.6" />
    </>
  ),
}

const fallback: Glyph = () => <rect x="8" y="8" width="32" height="32" rx="6" fill="#8b93a7" />

export function GameGlyph({ id, size = 48 }: { id: string; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const name = (n: string) => `${uid}-${n}`
  const url = (n: string) => `url(#${name(n)})`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {(glyphs[id] ?? fallback)(url, name)}
    </svg>
  )
}
