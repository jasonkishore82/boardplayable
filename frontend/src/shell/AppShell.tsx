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
  // anything. It follows the light or dark theme: a dark veil over it in dark mode, a pale one in light mode, so the
  // words stay readable either way.
  const backdrop = useBackdrop()
  // A picture, or the animated aurora: either way something sits behind the pages.
  const picture = backdrop.src ?? (backdrop.aurora ? 'aurora' : null)
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

  const [rail, toggleRail] = useSidebarRail()
  // Inside a game (/games/<id>, its lobby or a room) the sidebar and the phone tab bar step aside, so the game gets
  // the whole window. Every game screen has its own way back to Games.
  const inGame = section === 'games' && !!location.pathname.split('/')[2]

  return (
    <div
      className={styles.shell}
      data-app-backdrop={picture ? '' : undefined}
      data-rail={rail ? '' : undefined}
      data-game={inGame ? '' : undefined}
    >
      {picture && (
        // Keyed by the picture, so a newly chosen one fades in.
        <div
          key={picture}
          className={styles.backdrop}
          data-home={home ? '' : undefined}
          data-aurora={backdrop.aurora ? '' : undefined}
          style={backdrop.src ? { backgroundImage: `url("${backdrop.src}")` } : undefined}
          aria-hidden="true"
        >
          {/* The aurora: soft bands of the logo's red and purple, each drifting on its own slow loop. */}
          {backdrop.aurora && (
            <div className={styles.aurora}>
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      )}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className={styles.topbar} data-clear={picture ? '' : undefined}>
        {/* Sidebar only (hidden on phones): fold the sidebar down to icons, or open it out again. */}
        <button
          type="button"
          className={styles.collapse}
          onClick={toggleRail}
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={rail}
          title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className={styles.topbarInner}>
          <NavLink to="/games" className={styles.brand} aria-label="Board Playable, games">
            <Wordmark />
          </NavLink>
          {/* On wider screens this header is the left sidebar: logo, the menu down the side, theme at the bottom. */}
          <nav aria-label="Main" className={styles.topnav}>
            <p className={styles.navLabel}>Menu</p>
            <TabLinks withIcons iconSize={20} />
          </nav>
          <div className={styles.topbarEnd}>
            <ThemeToggle />
          </div>
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

const RAIL_KEY = 'sidebar-collapsed'
const NARROW = '(max-width: 1099px)'

/** Whether the sidebar is folded to icons. The player's choice is remembered on this device; until they choose,
 *  it is folded on narrower screens (under 1100px) and open on wider ones. */
function useSidebarRail(): [boolean, () => void] {
  const read = (): boolean | null => {
    try {
      const v = localStorage.getItem(RAIL_KEY)
      return v === null ? null : v === '1'
    } catch {
      return null
    }
  }
  const [choice, setChoice] = useState<boolean | null>(read)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const rail = choice ?? narrow
  const toggle = () => {
    const next = !rail
    setChoice(next)
    try {
      localStorage.setItem(RAIL_KEY, next ? '1' : '0')
    } catch {
      // still toggles for this visit
    }
  }
  return [rail, toggle]
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
