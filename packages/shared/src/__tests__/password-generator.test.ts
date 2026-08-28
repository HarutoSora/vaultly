import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GENERATOR_OPTIONS,
  estimatePasswordStrength,
  generatePassword,
} from '../password-generator'

describe('generatePassword', () => {
  it('produces a password of the requested length', () => {
    const password = generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 32 })
    expect(password.length).toBe(32)
  })

  it('includes at least one character from every selected type', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword({
        length: 12,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      })
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[^a-zA-Z0-9]/)
    }
  })

  it('only uses the selected character types', () => {
    const password = generatePassword({
      length: 40,
      uppercase: false,
      lowercase: true,
      numbers: false,
      symbols: false,
    })
    expect(password).toMatch(/^[a-z]+$/)
  })

  it('excludes visually ambiguous characters (0/O, 1/l/I)', () => {
    for (let i = 0; i < 20; i++) {
      const password = generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length: 40 })
      expect(password).not.toMatch(/[0O1lI]/)
    }
  })

  it('throws a clear error when no character type is selected', () => {
    expect(() =>
      generatePassword({ length: 12, uppercase: false, lowercase: false, numbers: false, symbols: false }),
    ).toThrow()
  })

  it('generates unique passwords across many calls (CSPRNG, not a fixed sequence)', () => {
    const passwords = new Set(Array.from({ length: 200 }, () => generatePassword(DEFAULT_GENERATOR_OPTIONS)))
    expect(passwords.size).toBe(200)
  })
})

describe('estimatePasswordStrength', () => {
  it('rates a short, single-charset password as weak', () => {
    expect(estimatePasswordStrength('abc').label).toBe('Weak')
  })

  it('rates a long, mixed-charset password as strong', () => {
    expect(estimatePasswordStrength('Tr0ub4dor&3xtra-long-passphrase!').label).toBe('Strong')
  })

  it('score increases monotonically with the strength label', () => {
    const weak = estimatePasswordStrength('abc')
    const strong = estimatePasswordStrength('Tr0ub4dor&3xtra-long-passphrase!')
    expect(strong.score).toBeGreaterThan(weak.score)
  })
})
