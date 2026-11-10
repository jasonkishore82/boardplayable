import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Wordmark } from '../components/Wordmark'
import styles from './AppShell.module.css'
import { TABS } from './tabs'

export function AppShell() {
  const location = useLocation()
  // Animate per tab, not per sub-route, so moving inside Games stays calm.
  const section = location.pathname.split('/')[1]

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <NavLink to="/games" className={styles.brand} aria-label="Board Playable, games">
            <Wordmark />
          </NavLink>
          <nav aria-label="Main" className={styles.topnav}>
            <TabLinks />
          </nav>
        </div>
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        <div key={section} className={styles.view}>
          <Outlet />
        </div>
      </main>

      <nav aria-label="Main" className={styles.bottomnav}>
        <TabLinks withIcons />
      </nav>
    </div>
  )
}

function TabLinks({ withIcons = false }: { withIcons?: boolean }) {
  return (
    <ul className={styles.tabs}>
      {TABS.map((tab) => (
        <li key={tab.to}>
          <NavLink to={tab.to} className={({ isActive }) => [styles.tab, isActive && styles.active].filter(Boolean).join(' ')}>
            {withIcons && (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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
