import { describe, expect, it } from 'vitest'
import { friendlyAuthError, validateEmail, validatePassword, validateUsername } from './validation'

describe('validation', () => {
  it('checks email', () => {
    expect(validateEmail('')).toBeTruthy()
    expect(validateEmail('nope')).toBeTruthy()
    expect(validateEmail('ada@example.com')).toBeUndefined()
  })

  it('checks username', () => {
    expect(validateUsername('ab')).toBeTruthy()
    expect(validateUsername('Ada Lovelace')).toBeTruthy()
    expect(validateUsername('ada_99')).toBeUndefined()
  })

  it('only enforces length on sign-up', () => {
    expect(validatePassword('short', 'sign-in')).toBeUndefined()
    expect(validatePassword('short', 'sign-up')).toBeTruthy()
    expect(validatePassword('', 'sign-in')).toBeTruthy()
  })

  it('maps auth errors to human copy', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toMatch(/don’t match/)
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many/)
    expect(friendlyAuthError({ message: 'weird' })).toMatch(/Something went wrong/)
  })
})
