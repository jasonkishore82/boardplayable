export type Field = 'email' | 'username' | 'password'
export type Errors = Partial<Record<Field, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME = /^[a-z0-9_]{3,20}$/

export const PASSWORD_MIN = 8

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Enter your email.'
  if (!EMAIL.test(value.trim())) return 'That email doesn’t look right.'
}

export function validateUsername(value: string): string | undefined {
  const v = value.trim()
  if (!v) return 'Choose a username.'
  if (v.length < 3) return 'At least 3 characters.'
  if (v.length > 20) return '20 characters at most.'
  if (!USERNAME.test(v)) return 'Use lowercase letters, numbers and underscores.'
}

export function validatePassword(value: string, mode: 'sign-in' | 'sign-up'): string | undefined {
  if (!value) return 'Enter your password.'
  if (mode === 'sign-up' && value.length < PASSWORD_MIN)
    return `Use at least ${PASSWORD_MIN} characters.`
}

// Turns Supabase auth errors into short, human messages.
export function friendlyAuthError(error: { message?: string; code?: string; status?: number }): string {
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials'))
    return 'That email and password don’t match.'
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'Confirm your email first. Check your inbox for the link.'
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return 'There’s already an account with this email.'
  if (code === 'weak_password' || msg.includes('password should'))
    return 'Choose a stronger password.'
  if (code.startsWith('over_') || error.status === 429 || msg.includes('rate limit'))
    return 'Too many attempts. Try again in a minute.'
  if (msg.includes('database error saving new user'))
    return 'That username was just taken. Try another.'
  if (msg.includes('fetch') || msg.includes('network'))
    return 'Can’t reach the server. Check your connection.'
  return 'Something went wrong. Try again.'
}
