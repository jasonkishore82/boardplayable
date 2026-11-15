import { useSyncExternalStore } from 'react'

// The player's own profile picture, chosen on the Profile page and kept on this device (per signed-in user).

const listeners = new Set<() => void>()
const keyOf = (userId: string) => `profile-picture:${userId}`

function read(userId: string): string | null {
  try {
    return localStorage.getItem(keyOf(userId))
  } catch {
    return null
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

/** Saves a picture (a data URL). Throws when the browser has no room for it. */
export function setProfilePicture(userId: string, dataUrl: string): void {
  localStorage.setItem(keyOf(userId), dataUrl)
  notify()
}

export function removeProfilePicture(userId: string): void {
  try {
    localStorage.removeItem(keyOf(userId))
  } catch {
    // Nothing to remove.
  }
  notify()
}

/** Crops a picture file to a centred square, shrinks it to 256 pixels and returns it as a JPEG data URL. */
export async function squarePictureToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(256, side)
  canvas
    .getContext('2d')!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProfilePicture(userId: string | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? read(userId) : null),
    () => null,
  )
}
