import { describe, expect, it } from 'vitest'
import { CsvImportError, parseChromePasswordsCsv } from '../csv-import'

describe('parseChromePasswordsCsv', () => {
  it('parses a standard Chrome export', () => {
    const csv = 'name,url,username,password\nGitHub,https://github.com/login,octocat,hunter2\n'
    const items = parseChromePasswordsCsv(csv)
    expect(items).toEqual([
      { name: 'GitHub', username: 'octocat', password: 'hunter2', website: 'https://github.com/login', notes: '' },
    ])
  })

  it('parses multiple rows', () => {
    const csv = [
      'name,url,username,password',
      'GitHub,https://github.com,octocat,pw1',
      'Reddit,https://reddit.com,octo,pw2',
    ].join('\n')
    expect(parseChromePasswordsCsv(csv)).toHaveLength(2)
  })

  it('handles quoted fields with embedded commas', () => {
    const csv = 'name,url,username,password\n"Smith, Inc.",https://example.com,user,pw\n'
    const items = parseChromePasswordsCsv(csv)
    expect(items[0].name).toBe('Smith, Inc.')
  })

  it('handles escaped double quotes inside a quoted field', () => {
    const csv = 'name,url,username,password\n"Say ""hi""",https://example.com,user,pw\n'
    const items = parseChromePasswordsCsv(csv)
    expect(items[0].name).toBe('Say "hi"')
  })

  it('falls back to the URL hostname when the name column is empty', () => {
    const csv = 'name,url,username,password\n,https://example.com/login,user,pw\n'
    const items = parseChromePasswordsCsv(csv)
    expect(items[0].name).toBe('example.com')
  })

  it('skips rows with no password — nothing usable to import', () => {
    const csv = 'name,url,username,password\nEmpty,https://example.com,user,\n'
    expect(parseChromePasswordsCsv(csv)).toHaveLength(0)
  })

  it('skips blank lines', () => {
    const csv = 'name,url,username,password\n\nGitHub,https://github.com,octocat,pw1\n\n'
    expect(parseChromePasswordsCsv(csv)).toHaveLength(1)
  })

  it('is tolerant of column order and capitalization', () => {
    const csv = 'Password,Username,Name,URL\npw1,octocat,GitHub,https://github.com\n'
    const items = parseChromePasswordsCsv(csv)
    expect(items[0]).toEqual({
      name: 'GitHub',
      username: 'octocat',
      password: 'pw1',
      website: 'https://github.com',
      notes: '',
    })
  })

  it('carries a note column when present', () => {
    const csv = 'name,url,username,password,note\nGitHub,https://github.com,octocat,pw1,2FA backup codes in drawer\n'
    expect(parseChromePasswordsCsv(csv)[0].notes).toBe('2FA backup codes in drawer')
  })

  it('returns an empty array for an empty file', () => {
    expect(parseChromePasswordsCsv('')).toEqual([])
  })

  it('rejects a file missing the required columns', () => {
    const csv = 'foo,bar\n1,2\n'
    expect(() => parseChromePasswordsCsv(csv)).toThrow(CsvImportError)
  })
})
