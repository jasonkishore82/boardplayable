import { describe, expect, it } from 'vitest'
import {
  friendlyApiError,
  friendlyAuthError,
  normalizeCode,
  validateCode,
  validateEmail,
  validatePassword,
  validateUsername,
} from './validation'

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

  it('checks the 6-digit code', () => {
    expect(validateCode('')).toBeTruthy()
    expect(validateCode('123')).toBeTruthy()
    expect(validateCode('123456')).toBeUndefined()
    expect(normalizeCode('12 34-56 78')).toBe('123456')
  })

  it('maps API errors', () => {
    expect(friendlyApiError({ status: 400, message: 'That code is wrong.' })).toBe('That code is wrong.')
    expect(friendlyApiError({ status: 503, message: '' })).toMatch(/unavailable/)
    expect(friendlyApiError({ status: 500, message: '' })).toMatch(/Something went wrong/)
  })

  it('maps auth errors to human copy', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toMatch(/don’t match/)
    expect(friendlyAuthError({ code: 'otp_expired' })).toMatch(/new one/)
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many/)
    expect(friendlyAuthError({ message: 'weird' })).toMatch(/Something went wrong/)
  })
})
