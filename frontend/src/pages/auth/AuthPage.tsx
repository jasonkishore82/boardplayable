import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  friendlyApiError,
  friendlyAuthError,
  normalizeCode,
  validateCode,
  validateEmail,
  validatePassword,
  validateUsername,
  type Errors,
  type Field,
} from '../../auth/validation'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { Wordmark } from '../../components/Wordmark'
import { api, ApiError } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import styles from './AuthPage.module.css'

const PieceScene = lazy(() => import('../../three/PieceScene'))

type Mode = 'sign-in' | 'sign-up' | 'reset' | 'verify'

const RESEND_SECONDS = 30

const COPY: Record<Mode, { title: string; lede: string; submit: string }> = {
  'sign-in': { title: 'Sign in', lede: 'Welcome back. Your table is waiting.', submit: 'Sign in' },
  'sign-up': { title: 'Create account', lede: 'Start with your email. We’ll send a code to confirm it.', submit: 'Send code' },
  verify: { title: 'Check your email', lede: '', submit: 'Confirm email' },
  reset: { title: 'Reset password', lede: 'We’ll email you a link to choose a new one.', submit: 'Send link' },
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [values, setValues] = useState({ email: '', username: '', password: '', code: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastMode = useRef(mode)
  const wide = useMediaQuery('(min-width: 960px)')

  const fields: Field[] =
    mode === 'sign-up'
      ? ['email']
      : mode === 'reset'
        ? ['email']
        : mode === 'verify'
          ? ['code']
          : ['email', 'password']

  // Counts down the "Send a new code" button.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  // Move focus to the heading when the form changes mode, so screen readers announce it.
  useEffect(() => {
    if (lastMode.current === mode) return
    lastMode.current = mode
    headingRef.current?.focus()
  }, [mode])

  function validate(field: Field, value: string): string | undefined {
    if (field === 'email') return validateEmail(value)
    if (field === 'username') return validateUsername(value)
    if (field === 'code') return validateCode(value)
    return validatePassword(value, mode === 'sign-up' ? 'sign-up' : 'sign-in')
  }

  function update(field: Field, value: string) {
    const next =
      field === 'username' ? value.toLowerCase() : field === 'code' ? normalizeCode(value) : value
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
    setValues((v) => ({ ...v, password: '', code: '' }))
  }

  function startVerification(email: string, message: string) {
    switchMode('verify')
    setNotice(message)
    setCooldown(RESEND_SECONDS)
    setValues((v) => ({ ...v, email }))
  }

  // Asks our API to email a 6-digit code.
  function sendCode(email: string) {
    return api('/v1/otp/send', { method: 'POST', body: JSON.stringify({ email }) })
  }

  function describe(error: unknown): string {
    return error instanceof ApiError
      ? friendlyApiError(error)
      : friendlyAuthError(error as { message?: string })
  }

  async function resendCode() {
    if (!supabase || cooldown > 0) return
    setFormError('')
    const email = values.email.trim()
    try {
      await sendCode(email)
    } catch (error) {
      setFormError(describe(error))
      return
    }
    setCooldown(RESEND_SECONDS)
    setNotice(`A new code is on its way to ${email}.`)
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
        if (error) {
          // Signed up earlier but never entered the code: send a fresh one and continue from there.
          if (error.code === 'email_not_confirmed') {
            await sendCode(email)
            startVerification(email, `Your email isn’t confirmed yet. We sent a new code to ${email}.`)
            return
          }
          throw error
        }
        // AuthProvider picks up the session and the router sends the user to Games.
      } else if (mode === 'sign-up') {
        // Step 1: confirm the email. Supabase emails a 6-digit code and creates the user once it is entered.
        await sendCode(email)
        startVerification(email, `We sent a 6-digit code to ${email}.`)
      } else if (mode === 'verify') {
        // Our API checks the code, then hands back a one-time token that Supabase turns into a session.
        const { token_hash } = await api<{ token_hash: string }>('/v1/otp/verify', {
          method: 'POST',
          body: JSON.stringify({ email, code: values.code }),
        })
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
        if (error) throw error
        // Step 2 done. The session is set, and the router sends a new user on to choose a username and password.
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        })
        if (error) throw error
        setNotice(`If ${email} has an account, a reset link is on its way.`)
      }
    } catch (error) {
      setFormError(describe(error))
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
          <p className={styles.lede}>
            {mode === 'verify'
              ? `We sent a 6-digit code to ${values.email.trim()}. Enter it to continue.`
              : copy.lede}
          </p>

          <form className={styles.form} onSubmit={submit} noValidate key={mode}>
            {mode !== 'verify' && (
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
            )}

            {mode === 'verify' && (
              <TextField
                id="auth-code"
                label="6-digit code"
                name="code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={values.code}
                onChange={(e) => update('code', e.target.value)}
                onBlur={() => blur('code')}
                error={errors.code}
                hint="Codes expire after an hour."
                trailing={
                  <Button
                    type="button"
                    variant="quiet"
                    className={styles.inlineLink}
                    onClick={resendCode}
                    disabled={cooldown > 0}
                  >
                    {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
                  </Button>
                }
              />
            )}

            {mode === 'sign-in' && (
              <TextField
                id="auth-password"
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={values.password}
                onChange={(e) => update('password', e.target.value)}
                onBlur={() => blur('password')}
                error={errors.password}
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
            {mode === 'verify' ? (
              <>
                Wrong email?{' '}
                <Button type="button" variant="quiet" onClick={() => switchMode('sign-up')}>
                  Start over
                </Button>
              </>
            ) : mode === 'sign-in' ? (
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
