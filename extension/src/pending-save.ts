/**
 * Hands a login form's captured credentials from the tab that submitted
 * them to whatever page loads next in that same tab — see the long comment
 * in content-script.ts for why this exists instead of showing the save
 * prompt synchronously on submit (the short version: the submitting page is
 * usually gone to a navigation within milliseconds, so a banner rendered
 * there never gets seen).
 * <para/>
 * chrome.storage.session on purpose, not .local: this only ever needs to
 * survive a few seconds across one navigation, never needs to persist to
 * disk, and clears itself if the browser closes mid-flow.
 */
import type { PendingSave } from './messages'

export const TTL_MS = 15_000

function key(tabId: number): string {
  return `pendingSave:${tabId}`
}

export async function setPendingSave(tabId: number, data: PendingSave): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: { ...data, createdAt: Date.now() } })
}

/** One-shot: the entry is removed as soon as it's read, so a later unrelated page load in the same tab never resurrects it. */
export async function takePendingSave(tabId: number): Promise<PendingSave | null> {
  const k = key(tabId)
  const result = await chrome.storage.session.get(k)
  const stored = result[k] as (PendingSave & { createdAt: number }) | undefined
  if (!stored) return null

  await chrome.storage.session.remove(k)
  if (Date.now() - stored.createdAt > TTL_MS) return null

  const { origin, username, password } = stored
  return { origin, username, password }
}
