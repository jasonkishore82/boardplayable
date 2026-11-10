import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  friendlyAuthError,
  validateEmail,
  validatePassword,
  validateUsername,
  type Errors,
  type Field,
} from '../../auth/validation'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { Wordmark } from '../../components/Wordmark'
import { supabase } from '../../lib/supabase'
import styles from './AuthPage.module.css'

const PieceScene = lazy(() => import('../../three/PieceScene'))

type Mode = 'sign-in' | 'sign-up' | 'reset'

const COPY: Record<Mode, { title: string; lede: string; submit: string }> = {
  'sign-in': { title: 'Sign in', lede: 'Welcome back. Your table is waiting.', submit: 'Sign in' },
  'sign-up': { title: 'Create account', lede: 'Pick a username your friends will know.', submit: 'Create account' },
  reset: { title: 'Reset password', lede: 'We’ll email you a link to choose a new one.', submit: 'Send link' },
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [values, setValues] = useState({ email: '', username: '', password: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastMode = useRef(mode)
  const wide = useMediaQuery('(min-width: 960px)')

  const fields: Field[] =
    mode === 'sign-up' ? ['email', 'username', 'password'] : mode === 'reset' ? ['email'] : ['email', 'password']

  // Move focus to the heading when the form changes mode, so screen readers announce it.
  useEffect(() => {
    if (lastMode.current === mode) return
    lastMode.current = mode
    headingRef.current?.focus()
  }, [mode])

  function validate(field: Field, value: string): string | undefined {
    if (field === 'email') return validateEmail(value)
    if (field === 'username') return validateUsername(value)
    return validatePassword(value, mode === 'sign-up' ? 'sign-up' : 'sign-in')
  }

  function update(field: Field, value: string) {
    const next = field === 'username' ? value.toLowerCase() : value
    setValues((v) => ({ ...v, [field]: next }))
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validate(field, next) }))
    setFormError('')
  }

  function blur(field: Field) {
    if (!values[field]) return // don't nag on an untouched empty field
    setTouched((t) => ({ ...t, [field]: true }))
    setErrors((e) => ({ ...e, [field]: validate(field, values[field]) }))
  }

  function switchMode(next: Mode) {
    setMode(next)
    setErrors({})
    setTouched({})
    setFormError('')
    setNotice('')
    setValues((v) => ({ ...v, password: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Errors = {}
    for (const f of fields) nextErrors[f] = validate(f, values[f])
    setErrors(nextErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    const firstInvalid = fields.find((f) => nextErrors[f])
    if (firstInvalid) {
      document.getElementById(`auth-${firstInvalid}`)?.focus()
      return
    }
    if (!supabase) return

    setLoading(true)
    setFormError('')
    const email = values.email.trim()
    const origin = window.location.origin

    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: values.password })
        if (error) throw error
        // AuthProvider picks up the session and the router sends the user to Games.
      } else if (mode === 'sign-up') {
        const username = values.username.trim()
        const { data: available, error: rpcError } = await supabase.rpc('username_available', { name: username })
        if (!rpcError && available === false) {
          setErrors((e) => ({ ...e, username: 'That username is taken.' }))
          document.getElementById('auth-username')?.focus()
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: values.password,
          options: { data: { username }, emailRedirectTo: `${origin}/games` },
        })
        if (error) throw error
        if (!data.session) {
          switchMode('sign-in')
          setNotice(`Check ${email} to confirm your account, then sign in.`)
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        })
        if (error) throw error
        setNotice(`If ${email} has an account, a reset link is on its way.`)
      }
    } catch (error) {
      setFormError(friendlyAuthError(error as { message?: string }))
    } finally {
      setLoading(false)
    }
  }

  const copy = COPY[mode]

  return (
    <div className={styles.page}>
      <main className={styles.panel} id="main">
        <header className={styles.brand}>
          <Wordmark />
        </header>

        <div className={styles.formWrap}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {copy.title}
          </h1>
          <p className={styles.lede}>{copy.lede}</p>

          <form className={styles.form} onSubmit={submit} noValidate key={mode}>
            <TextField
              id="auth-email"
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              onBlur={() => blur('email')}
              error={errors.email}
            />

            {mode === 'sign-up' && (
              <TextField
                id="auth-username"
                label="Username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                value={values.username}
                onChange={(e) => update('username', e.target.value)}
                onBlur={() => blur('username')}
                error={errors.username}
                hint="3–20 characters. Letters, numbers, underscores."
              />
            )}

            {mode !== 'reset' && (
              <TextField
                id="auth-password"
                label="Password"
                type="password"
                name="password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                value={values.password}
                onChange={(e) => update('password', e.target.value)}
                onBlur={() => blur('password')}
                error={errors.password}
                hint={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
                trailing={
                  mode === 'sign-in' && (
                    <Button type="button" variant="quiet" className={styles.inlineLink} onClick={() => switchMode('reset')}>
                      Forgot password?
                    </Button>
                  )
                }
              />
            )}

            <div aria-live="polite" className={styles.live}>
              {formError && (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              )}
              {notice && !formError && <p className={styles.notice}>{notice}</p>}
            </div>

            <Button type="submit" block loading={loading}>
              {copy.submit}
            </Button>
          </form>

          <p className={styles.switch}>
            {mode === 'sign-in' ? (
              <>
                New here?{' '}
                <Button type="button" variant="quiet" onClick={() => switchMode('sign-up')}>
                  Create account
                </Button>
              </>
            ) : (
              <>
                {mode === 'sign-up' ? 'Already have an account?' : 'Remembered it?'}{' '}
                <Button type="button" variant="quiet" onClick={() => switchMode('sign-in')}>
                  Sign in
                </Button>
              </>
            )}
          </p>
        </div>
      </main>

      {wide && (
        <aside className={styles.stage} aria-hidden="true">
          <Suspense fallback={null}>
            <PieceScene />
          </Suspense>
          <p className={styles.caption}>Chess, battleship, snakes and ladders, and more. In 3D, with friends.</p>
        </aside>
      )}
    </div>
  )
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
