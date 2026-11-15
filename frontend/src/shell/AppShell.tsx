import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { Wordmark } from '../components/Wordmark'
import { useBackdrop } from '../lib/backdrop'
import styles from './AppShell.module.css'
import { TABS } from './tabs'

export function AppShell() {
  const location = useLocation()
  const section = location.pathname.split('/')[1]
  // Animate per tab, not per sub-route, so moving inside a tab stays calm. The one exception is opening or
  // leaving a game, which fades.
  const viewKey = section === 'games' ? location.pathname.split('/').slice(1, 3).join('/') : section
  // The backdrop picture (chosen in Profile) sits behind every page in the app, so a new page gets it without doing
  // anything. Over a picture the whole app uses the dark colours, so the words stay readable.
  const backdrop = useBackdrop()
  const picture = backdrop.src
  // The Games home screen shows the most of the picture: it gets a lighter veil. The top bar is see-through over a
  // picture on every page.
  const home = location.pathname.replace(/\/+$/, '') === '/games'

  // Which way the new page comes in from: the right when moving to a tab further right, the left otherwise.
  const tabIndex = TABS.findIndex((tab) => location.pathname.startsWith(tab.to))
  const lastTab = useRef(tabIndex)
  const direction = useRef(1)
  if (lastTab.current !== tabIndex) {
    direction.current = tabIndex > lastTab.current ? 1 : -1
    lastTab.current = tabIndex
  }

  return (
    <div
      className={styles.shell}
      data-theme={picture ? 'dark' : undefined}
      data-app-backdrop={picture ? '' : undefined}
    >
      {picture && (
        // Keyed by the picture, so a newly chosen one fades in.
        <div
          key={picture}
          className={styles.backdrop}
          data-home={home ? '' : undefined}
          style={{ backgroundImage: `url("${picture}")` }}
          aria-hidden="true"
        />
      )}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className={styles.topbar} data-clear={picture ? '' : undefined}>
        <div className={styles.topbarInner}>
          <NavLink to="/games" className={styles.brand} aria-label="Board Playable, games">
            <Wordmark />
          </NavLink>
          <nav aria-label="Main" className={styles.topnav}>
            <TabLinks withIcons iconSize={18} slider />
          </nav>
          {/* Over a picture the colours are always dark, so there is nothing to switch. The empty span keeps the
              tabs centred. */}
          {picture ? <span /> : <ThemeToggle />}
        </div>
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        {/* The Games pages have a picture fixed to the window behind them, which a sliding parent would drag
            along, so they only fade. The other tabs slide in as well. */}
        <div
          key={viewKey}
          className={styles.view}
          data-slide={section === 'games' ? undefined : ''}
          style={{ '--dir': direction.current } as CSSProperties}
        >
          <Outlet />
        </div>
      </main>

      <nav aria-label="Main" className={styles.bottomnav}>
        <TabLinks withIcons />
      </nav>
    </div>
  )
}

type TabLinksProps = {
  withIcons?: boolean
  iconSize?: number
  /** Draw the filled pill as one piece that slides to the tab you are on. */
  slider?: boolean
}

function TabLinks({ withIcons = false, iconSize = 24, slider = false }: TabLinksProps) {
  const location = useLocation()
  const list = useRef<HTMLUListElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)
  // The pill is placed without motion the first time, then glides.
  const [moving, setMoving] = useState(false)

  // Measure the active tab and put the pill behind it. Measured again when the row changes size (fonts loading,
  // the window resizing).
  useLayoutEffect(() => {
    if (!slider || !list.current) return
    const row = list.current
    const measure = () => {
      const active = row.querySelector<HTMLElement>('a[aria-current="page"]')
      setPill(active ? { x: active.offsetLeft, width: active.offsetWidth } : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [slider, location.pathname])

  useEffect(() => {
    if (!pill || moving) return
    const frame = requestAnimationFrame(() => setMoving(true))
    return () => cancelAnimationFrame(frame)
  }, [pill, moving])

  return (
    <ul className={styles.tabs} ref={list}>
      {slider && pill && (
        <li
          className={[styles.pill, moving && styles.pillMoving].filter(Boolean).join(' ')}
          style={{ width: pill.width, transform: `translateX(${pill.x}px)` }}
          aria-hidden="true"
        />
      )}
      {TABS.map((tab) => (
        <li key={tab.to}>
          <NavLink to={tab.to} className={({ isActive }) => [styles.tab, isActive && styles.active].filter(Boolean).join(' ')}>
            {withIcons && (
              <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {tab.icon}
              </svg>
            )}
            <span>{tab.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
