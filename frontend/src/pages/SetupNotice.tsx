import { Wordmark } from '../components/Wordmark'
import styles from './auth/AuthPage.module.css'

// Shown instead of the app when required environment variables are missing.
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className={styles.page}>
      <main className={styles.panel} id="main">
        <header className={styles.brand}>
          <Wordmark />
        </header>
        <div className={styles.formWrap}>
          <h1>Almost there</h1>
          <p className={styles.lede}>
            Add these to <code>frontend/.env.local</code> (or your Vercel project settings), then restart:
          </p>
          <ul>
            {missing.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
