/**
 * The one function standing between "autofill is convenient" and "autofill
 * leaks a credential to the wrong site." Deliberately strict: exact
 * hostname equality only — no substring/suffix matching, no subdomain
 * generalization (a credential saved for `app.example.com` does not match
 * `example.com` or `evil-app.example.com`). Scheme (http vs https) and port
 * are ignored, matching how every mainstream password manager treats them.
 */
export function hostnameOf(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function matchesOrigin(savedWebsite: string, pageOrigin: string): boolean {
  const savedHost = hostnameOf(savedWebsite)
  const pageHost = hostnameOf(pageOrigin)
  return savedHost !== null && pageHost !== null && savedHost === pageHost
}
