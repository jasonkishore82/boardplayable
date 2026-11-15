import { useSyncExternalStore } from 'react'

// The picture behind every page in the app (the app shell draws it). Chosen in Profile and remembered on this
// device, like the theme.
// To add a picture: put the file in public/backgrounds/ and add a line to BACKDROPS.

/** `aurora` is the animated brand backdrop, drawn in CSS rather than from a picture. */
export type BackdropOption = { id: string; name: string; src: string | null; aurora?: boolean }

export const BACKDROPS: BackdropOption[] = [
  { id: 'none', name: 'None', src: null },
  { id: 'aurora', name: 'Aurora', src: null, aurora: true },
  { id: 'dusk', name: 'Dusk city', src: '/backgrounds/chess-dusk.webp' },
]

/** The id of the picture the player uploaded themselves. */
export const CUSTOM_ID = 'custom'

export type Backdrop = {
  id: string
  /** The picture to show, or null for no backdrop. */
  src: string | null
  /** The animated aurora in the logo's colours, instead of a picture. */
  aurora: boolean
  /** The uploaded picture (a data URL), kept even while another backdrop is chosen. */
  custom: string | null
}

const KEY = 'backdrop'
const CUSTOM_KEY = 'backdrop-custom'
// Plain dark by default; the animated aurora is still offered in Profile.
const DEFAULT_ID = 'none'
const listeners = new Set<() => void>()

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // storage can be blocked (private windows)
  }
}

function resolve(id: string | null, custom: string | null): Backdrop {
  if (id === CUSTOM_ID && custom) return { id: CUSTOM_ID, src: custom, aurora: false, custom }
  const option = BACKDROPS.find((o) => o.id === id) ?? BACKDROPS.find((o) => o.id === DEFAULT_ID)!
  return { id: option.id, src: option.src, aurora: !!option.aurora, custom }
}

let current = resolve(read(KEY), read(CUSTOM_KEY))

function change(next: Backdrop) {
  current = next
  listeners.forEach((listener) => listener())
}

export function setBackdrop(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // The backdrop still changes for this visit.
  }
  change(resolve(id, current.custom))
}

/** Saves an uploaded picture and switches to it. Throws when the browser has no room to store it. */
export function setCustomBackdrop(dataUrl: string): void {
  localStorage.setItem(CUSTOM_KEY, dataUrl)
  localStorage.setItem(KEY, CUSTOM_ID)
  change(resolve(CUSTOM_ID, dataUrl))
}

export function removeCustomBackdrop(): void {
  try {
    localStorage.removeItem(CUSTOM_KEY)
    if (current.id === CUSTOM_ID) localStorage.setItem(KEY, DEFAULT_ID)
  } catch {
    // Nothing to remove.
  }
  change(resolve(current.id === CUSTOM_ID ? DEFAULT_ID : current.id, null))
}

/** Shrinks a picture file to at most 1920 pixels wide and returns it as a JPEG data URL, small enough to store. */
export async function pictureToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1920 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBackdrop(): Backdrop {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  )
}
