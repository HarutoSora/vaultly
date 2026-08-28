import { describe, expect, it } from 'vitest'
import { faviconUrl } from '../favicon'

describe('faviconUrl', () => {
  it('builds a direct favicon.ico URL from a full URL with a path', () => {
    expect(faviconUrl('https://github.com/login')).toBe('https://github.com/favicon.ico')
  })

  it('adds https:// when the saved website has no scheme', () => {
    expect(faviconUrl('github.com')).toBe('https://github.com/favicon.ico')
  })

  it('strips a port from the resulting favicon host (goes to the site root, not the app port)', () => {
    expect(faviconUrl('https://example.com:8443/app')).toBe('https://example.com/favicon.ico')
  })

  it('lowercases the hostname', () => {
    expect(faviconUrl('https://GitHub.com')).toBe('https://github.com/favicon.ico')
  })

  it('returns null for an empty website', () => {
    expect(faviconUrl('')).toBeNull()
  })

  it('returns null for unparseable input instead of throwing', () => {
    expect(faviconUrl('not a url and not a domain either!!')).toBeNull()
  })
})
