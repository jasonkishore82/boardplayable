import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { authBackend } from '../../lib/auth'
import styles from './ProfilePage.module.css'

type Stats = { played: number; won: number }

const CONFIRM_WORD = 'delete'

export function ProfilePage() {
  const { user, username, signOut } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Totals across games. Stays at zero until games start recording results.
  useEffect(() => {
    if (!authBackend || !user) return
    authBackend.getStats().then(setStats, () => setStats({ played: 0, won: 0 }))
  }, [user])

  function cancelDelete() {
    setConfirming(false)
    setTyped('')
    setDeleteError('')
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    if (!authBackend || typed.trim().toLowerCase() !== CONFIRM_WORD) return
    setDeleting(true)
    setDeleteError('')
    try {
      await authBackend.deleteAccount()
    } catch {
      setDeleting(false)
      setDeleteError('We couldn’t delete your account. Try again in a moment.')
      return
    }
    // The user no longer exists; this clears the local session and the router returns to sign-in.
    await signOut()
  }

  const name = username ?? user?.email?.split('@')[0] ?? 'Player'
  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null
  const played = stats?.played ?? 0
  const won = stats?.won ?? 0

  return (
    <>
      <PageHeader title="Profile" />

      <div className={styles.identity}>
        <div className={styles.avatar} aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className={styles.name}>{name}</p>
          <p className={styles.meta}>
            {user?.email}
            {joined && <> · Joined {joined}</>}
          </p>
        </div>
      </div>

      <Section title="Stats">
        <dl className={styles.stats}>
          <Stat label="Games played" value={played} />
          <Stat label="Won" value={won} />
          <Stat label="Win rate" value={played ? `${Math.round((won / played) * 100)}%` : '—'} />
        </dl>
      </Section>

      <Section title="Account">
        <div className={styles.account}>
          <p className={styles.meta}>Avatar and username changes are coming soon.</p>
          <Button
            variant="secondary"
            loading={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await signOut()
            }}
          >
            Sign out
          </Button>
        </div>
      </Section>

      <Section title="Delete account">
        <div className={styles.danger}>
          <p className={styles.meta}>
            Permanently removes your profile, friends, invites and stats. This can’t be undone.
          </p>
          {!confirming ? (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          ) : (
            <form className={styles.confirm} onSubmit={deleteAccount} noValidate>
              <TextField
                id="delete-confirm"
                label={`Type “${CONFIRM_WORD}” to confirm`}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                error={deleteError || undefined}
              />
              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="danger"
                  loading={deleting}
                  disabled={typed.trim().toLowerCase() !== CONFIRM_WORD}
                >
                  Delete my account forever
                </Button>
                <Button type="button" variant="secondary" onClick={cancelDelete} disabled={deleting}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </Section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
