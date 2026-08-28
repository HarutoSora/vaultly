import { describe, expect, it } from 'vitest'
import { searchScore } from '../search'

describe('searchScore', () => {
  it('returns a positive score for everything when the query is empty', () => {
    expect(searchScore({ name: 'Anything' }, '')).toBeGreaterThan(0)
  })

  it('ranks a name that starts with the query above one that only contains it', () => {
    const startsWith = searchScore({ name: 'Gmail' }, 'gmail')
    const contains = searchScore({ name: 'My Gmail Backup' }, 'gmail')
    expect(startsWith).toBeGreaterThan(contains)
  })

  it('ranks a name match above a username/website-only match', () => {
    const nameMatch = searchScore({ name: 'Gmail', username: 'x@example.com' }, 'gmail')
    const usernameOnlyMatch = searchScore({ name: 'Netflix', username: 'me@gmail.com' }, 'gmail')
    expect(nameMatch).toBeGreaterThan(usernameOnlyMatch)
  })

  it('still matches on username when the name does not match — just lower-ranked, not excluded', () => {
    const score = searchScore({ name: 'Netflix', username: 'me@gmail.com' }, 'gmail')
    expect(score).toBeGreaterThan(0)
  })

  it('matches on website too', () => {
    const score = searchScore({ name: 'Work Portal', website: 'https://gmail.corp.example.com' }, 'gmail')
    expect(score).toBeGreaterThan(0)
  })

  it('excludes an item that matches nothing', () => {
    expect(searchScore({ name: 'Netflix', username: 'someone', website: 'netflix.com' }, 'zzz-no-match')).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(searchScore({ name: 'GitHub' }, 'GITHUB')).toBeGreaterThan(0)
  })

  it('works with no username/website at all (e.g. non-Login item types)', () => {
    expect(searchScore({ name: 'My Secure Note' }, 'secure')).toBeGreaterThan(0)
    expect(searchScore({ name: 'My Secure Note' }, 'nomatch')).toBe(0)
  })
})
