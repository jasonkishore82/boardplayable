import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { friendlyAuthError, validatePassword } from '../../auth/validation'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { Wordmark } from '../../components/Wordmark'
import { authBackend } from '../../lib/auth'
import styles from './AuthPage.module.css'

// Reached from the email link. Supabase signs the user in from the link, then they set a new password.
export function ResetPasswordPage() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = validatePassword(password, 'sign-up')
    setError(problem)
    if (problem || !authBackend) return
    setLoading(true)
    try {
      await authBackend.setPassword(password)
      navigate('/games', { replace: true })
    } catch (error) {
      setFormError(friendlyAuthError(error as { message?: string }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.panel} id="main">
        <header className={styles.brand}>
          <Wordmark />
        </header>
        <div className={styles.formWrap}>
          <h1>New password</h1>
          {authLoading ? null : session ? (
            <>
              <p className={styles.lede}>Choose something you haven’t used here before.</p>
              <form className={styles.form} onSubmit={submit} noValidate>
                <TextField
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(validatePassword(e.target.value, 'sign-up'))
                  }}
                  error={error}
                  hint="At least 8 characters."
                />
                <div aria-live="polite" className={styles.live}>
                  {formError && <p className={styles.formError} role="alert">{formError}</p>}
                </div>
                <Button type="submit" block loading={loading}>
                  Save password
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className={styles.lede}>This link has expired or was already used.</p>
              <p className={styles.switch}>
                <Link to="/sign-in">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
