import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TTL_MS, setPendingSave, takePendingSave } from '../pending-save'

const DATA = { origin: 'https://example.com', username: 'me', password: 'hunter2' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('setPendingSave / takePendingSave', () => {
  it('round-trips the exact data that was set', async () => {
    await setPendingSave(1, DATA)
    expect(await takePendingSave(1)).toEqual(DATA)
  })

  it('is one-shot — a second take for the same tab returns null', async () => {
    await setPendingSave(1, DATA)
    await takePendingSave(1)
    expect(await takePendingSave(1)).toBeNull()
  })

  it('returns null for a tab nothing was ever set for', async () => {
    expect(await takePendingSave(999)).toBeNull()
  })

  it('keeps separate tabs independent', async () => {
    await setPendingSave(1, DATA)
    await setPendingSave(2, { ...DATA, username: 'other' })

    expect((await takePendingSave(2))?.username).toBe('other')
    expect((await takePendingSave(1))?.username).toBe('me')
  })

  it('expires after the TTL — a stale entry is discarded, not returned', async () => {
    await setPendingSave(1, DATA)
    vi.advanceTimersByTime(TTL_MS + 1)
    expect(await takePendingSave(1)).toBeNull()
  })

  it('is still valid just under the TTL boundary', async () => {
    await setPendingSave(1, DATA)
    vi.advanceTimersByTime(TTL_MS - 1)
    expect(await takePendingSave(1)).toEqual(DATA)
  })

  it('consumes (deletes) an expired entry too — a second take after expiry still returns null, not a resurrected stale value', async () => {
    await setPendingSave(1, DATA)
    vi.advanceTimersByTime(TTL_MS + 1)
    await takePendingSave(1)
    expect(await takePendingSave(1)).toBeNull()
  })
})
