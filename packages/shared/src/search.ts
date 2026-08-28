/**
 * The one ranking function behind every "search my vault" box in the app —
 * the web UI's vault list and the extension popup's vault list both call
 * this instead of keeping two copies that could quietly drift apart.
 */
export interface SearchableItem {
  name: string
  /** Only Login items have these; omit for other item types. */
  username?: string
  website?: string
}

/**
 * Higher is more relevant; 0 means "doesn't match, exclude it." Ranked
 * rather than a plain boolean so that e.g. searching "gmail" puts an item
 * actually named "Gmail" first, instead of burying it among every other
 * login whose username happens to be a @gmail.com address too.
 */
export function searchScore(item: SearchableItem, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const name = item.name.toLowerCase()

  if (name.startsWith(q)) return 3
  if (name.includes(q)) return 2

  if (
    (item.username && item.username.toLowerCase().includes(q)) ||
    (item.website && item.website.toLowerCase().includes(q))
  ) {
    return 1
  }

  return 0
}
