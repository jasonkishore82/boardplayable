import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { validatePassword, validateUsername } from '../../auth/validation'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { Wordmark } from '../../components/Wordmark'
import { supabase } from '../../lib/supabase'
import styles from './AuthPage.module.css'

// Step 3 of sign-up. The email is already confirmed with a code; now choose a username and password.
export function FinishSignUpPage() {
  const { session, username, user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) return null
  if (!session) return <Navigate to="/sign-in" replace />
  if (username) return <Navigate to="/games" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = values.username.trim()
    const next = { username: validateUsername(name), password: validatePassword(values.password, 'sign-up') }
    setErrors(next)
    if (next.username || next.password || !supabase) {
      document.getElementById(next.username ? 'finish-username' : 'finish-password')?.focus()
      return
    }

    setLoading(true)
    setFormError('')
    // Claim the username first. It fails with a duplicate error when the name is taken.
    const { error: claimError } = await supabase.rpc('complete_signup', { name })
    if (claimError) {
      setLoading(false)
      if (claimError.code === '23505' || claimError.message.toLowerCase().includes('duplicate')) {
        setErrors({ username: 'That username is taken.' })
        document.getElementById('finish-username')?.focus()
      } else {
        setFormError('Something went wrong. Try again.')
      }
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
      data: { username: name },
    })
    setLoading(false)
    if (updateError) {
      setFormError(
        updateError.code === 'weak_password' ? 'Choose a stronger password.' : 'Something went wrong. Try again.',
      )
      return
    }
    navigate('/games', { replace: true })
  }

  return (
    <div className={styles.page}>
      <main className={styles.panel} id="main">
        <header className={styles.brand}>
          <Wordmark />
        </header>
        <div className={styles.formWrap}>
          <h1 className={styles.title}>Almost there</h1>
          <p className={styles.lede}>
            {user?.email} is confirmed. Pick a username your friends will know, and a password.
          </p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <TextField
              id="finish-username"
              label="Username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              autoFocus
              value={values.username}
              onChange={(e) => {
                const v = e.target.value.toLowerCase()
                setValues((s) => ({ ...s, username: v }))
                if (errors.username) setErrors((er) => ({ ...er, username: validateUsername(v) }))
                setFormError('')
              }}
              error={errors.username}
              hint="3–20 characters. Letters, numbers, underscores."
            />
            <TextField
              id="finish-password"
              label="Password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => {
                const v = e.target.value
                setValues((s) => ({ ...s, password: v }))
                if (errors.password) setErrors((er) => ({ ...er, password: validatePassword(v, 'sign-up') }))
                setFormError('')
              }}
              error={errors.password}
              hint="At least 8 characters."
            />
            <div aria-live="polite" className={styles.live}>
              {formError && (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              )}
            </div>
            <Button type="submit" block loading={loading}>
              Create account
            </Button>
          </form>
          <p className={styles.switch}>
            Wrong email?{' '}
            <Button type="button" variant="quiet" onClick={() => signOut()}>
              Start over
            </Button>
          </p>
        </div>
      </main>
    </div>
  )
}
