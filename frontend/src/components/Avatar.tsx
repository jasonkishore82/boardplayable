import { useEffect, useState } from 'react'
import { initials } from '../lib/initials'
import styles from './Avatar.module.css'

type Props = {
  /** Used for the initials shown until a picture exists. */
  name: string
  /** A picture to show. Give a list to try several files in turn (the first that loads wins). */
  src?: string | string[] | null
  /** Width and height in pixels. */
  size?: number
  className?: string
}

/** A steady colour per name, so people and bots without a picture are still easy to tell apart. */
function hueOf(name: string): number {
  let hue = 0
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360
  return hue
}

// A profile picture: a curved square holding the picture, or the person's initials when there is no picture yet.
// Drop images into the places listed in public/avatars/README.md and they appear with no code change.
export function Avatar({ name, src, size = 40, className }: Props) {
  const sources = Array.isArray(src) ? src : src ? [src] : []
  const key = sources.join('|')
  const [tried, setTried] = useState(0)
  useEffect(() => setTried(0), [key])
  const current = sources[tried]
  const hue = hueOf(name)

  return (
    <span
      className={[styles.avatar, className].filter(Boolean).join(' ')}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 32% 24%)`,
        color: `hsl(${hue} 80% 86%)`,
      }}
      aria-hidden="true"
    >
      {current ? (
        <img key={current} src={current} alt="" loading="lazy" draggable={false} onError={() => setTried((n) => n + 1)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}
