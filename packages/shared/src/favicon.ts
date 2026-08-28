/**
 * Resolves a saved website URL to its favicon — fetched directly from the
 * site itself (`https://{hostname}/favicon.ico`), not a third-party favicon
 * API. Google's and DuckDuckGo's favicon services are the common shortcut,
 * but they'd mean sending every domain in someone's vault to one company in
 * a burst — a much bigger fingerprint than each site individually seeing a
 * single favicon request for itself, which is what fetching direct does.
 */
export function faviconUrl(website: string): string | null {
  if (!website) {
    return null
  }
  try {
    const url = new URL(website.includes('://') ? website : `https://${website}`)
    return `https://${url.hostname}/favicon.ico`
  } catch {
    return null
  }
}
