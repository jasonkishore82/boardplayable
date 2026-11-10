import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { Section } from '../../components/Section'
import { supabase } from '../../lib/supabase'
import styles from './ProfilePage.module.css'

type Stats = { played: number; won: number }

export function ProfilePage() {
  const { user, username, signOut } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  // Totals across games. Stays at zero until games start recording results.
  useEffect(() => {
    if (!supabase || !user) return
    supabase
      .from('game_stats')
      .select('played, won')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const rows = data ?? []
        setStats({
          played: rows.reduce((n, r) => n + r.played, 0),
          won: rows.reduce((n, r) => n + r.won, 0),
        })
      })
  }, [user])

  const name = username ?? user?.email?.split('@')[0] ?? 'Player'
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
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
