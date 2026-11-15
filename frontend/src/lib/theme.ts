import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'theme'
const listeners = new Set<() => void>()

// index.html sets data-theme on <html> before the page paints, so this only reads it back.
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage can be blocked (private windows). The theme still changes for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme)
  return [theme, setTheme]
}
