import { describe, expect, it } from 'vitest'
import { hostnameOf, matchesOrigin } from '../origin-match'

describe('matchesOrigin', () => {
  it('matches the exact same origin', () => {
    expect(matchesOrigin('https://example.com', 'https://example.com')).toBe(true)
  })

  it('matches a saved website with a path against a bare page origin', () => {
    expect(matchesOrigin('https://example.com/login', 'https://example.com')).toBe(true)
  })

  it('ignores scheme (http vs https) — mainstream password managers treat these as the same site', () => {
    expect(matchesOrigin('http://example.com', 'https://example.com')).toBe(true)
  })

  it('rejects a completely different domain', () => {
    expect(matchesOrigin('https://example.com', 'https://evil.com')).toBe(false)
  })

  it('rejects a look-alike domain (no substring/suffix matching)', () => {
    expect(matchesOrigin('https://example.com', 'https://notexample.com')).toBe(false)
    expect(matchesOrigin('https://example.com', 'https://example.com.evil.com')).toBe(false)
  })

  it('rejects a subdomain that does not exactly match — no generalization either direction', () => {
    expect(matchesOrigin('https://app.example.com', 'https://example.com')).toBe(false)
    expect(matchesOrigin('https://example.com', 'https://app.example.com')).toBe(false)
    expect(matchesOrigin('https://app.example.com', 'https://evil-app.example.com')).toBe(false)
  })

  it('is case-insensitive on hostname', () => {
    expect(matchesOrigin('https://Example.com', 'https://example.COM')).toBe(true)
  })

  it('never matches when either side is not a valid URL — fails closed, not open', () => {
    expect(matchesOrigin('not a url', 'https://example.com')).toBe(false)
    expect(matchesOrigin('https://example.com', 'not a url')).toBe(false)
    expect(matchesOrigin('', '')).toBe(false)
  })
})

describe('hostnameOf', () => {
  it('extracts a lowercased hostname, ignoring port and path', () => {
    expect(hostnameOf('https://Example.COM:8080/path')).toBe('example.com')
  })

  it('returns null for unparseable input instead of throwing', () => {
    expect(hostnameOf('')).toBeNull()
    expect(hostnameOf('not a url')).toBeNull()
  })

  it('a scheme with no real host (e.g. javascript:) never equals a real hostname', () => {
    expect(matchesOrigin('javascript:alert(1)', 'https://example.com')).toBe(false)
  })
})
