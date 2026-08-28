# Vaultly — Privacy Policy

**Effective date:** 2026-08-28

This policy covers the **Vaultly Chrome extension as distributed on the
Chrome Web Store** — the fully standalone build described in
[`SECURITY.md`](../SECURITY.md) and [`docs/cryptography.md`](cryptography.md).
That build has no account system and no server component; this document
describes exactly that build, not the separately-hosted web app/backend in
this repository, which a Chrome Web Store user never installs or connects to.

## The short version

Vaultly does not collect, transmit, or have access to any of your data.
Everything you save is encrypted on your device with a key derived from
your own master password, and stored only in that browser's local storage.
There is no server. There is nothing for us to see, log, sell, or lose in a
breach, because nothing ever leaves your device in the first place.

## What data is stored, and where

- **Your vault** (logins you save — name, username, password, website,
  notes) is encrypted client-side (Argon2id + AES-256-GCM — see
  [`docs/cryptography.md`](cryptography.md) for the exact chain) and stored
  in this browser's IndexedDB, inside the extension's own isolated storage
  partition. It is never readable by any website, by any other extension,
  or by us.
- **Your master password is never stored anywhere**, in any form — only a
  key derived from it, which itself never leaves the device.
- A small amount of non-secret setup data (the random salt used to derive
  your encryption key, and your encrypted vault key) lives in
  `chrome.storage.local`, also local to your device.
- **We do not operate a server that this build talks to.** There is no
  account, no sign-in, no analytics, and no telemetry of any kind.

## What the extension reads on web pages, and why

The content script runs on the pages you visit for two purposes only,
both entirely local to your device:

1. **Autofill** — only when you explicitly click "Fill" for a specific
   saved credential in the popup, it fills that page's username/password
   fields. It never fills anything automatically.
2. **Save-prompt detection** — when you submit a login form, it briefly
   holds the submitted username/password (in `chrome.storage.session`, for
   at most 15 seconds, cleared as soon as it's read) so it can offer to
   save them once the resulting page finishes loading. If you decline or
   ignore the prompt, nothing is saved and the data is discarded.

Neither of these ever sends page content anywhere — not to us, not to any
third party. Autofill matching is restricted to an **exact** hostname
match between a saved item and the current page; there is no fuzzy or
partial matching, so a saved credential can never be offered to the wrong
site.

## Third-party requests

- **Site favicons.** When the popup shows a saved login, it requests that
  site's own `favicon.ico` directly from the site itself (e.g.,
  `https://github.com/favicon.ico`), so the icon you see is genuinely that
  site's. This is a normal image request your browser makes to the site in
  question — the same as visiting the site itself — and reveals nothing to
  us. We deliberately do not use a third-party favicon API (like Google's
  or DuckDuckGo's), which would otherwise see your entire list of saved
  domains in one place.
- **The "Donate" button** in the popup links out to a PayPal.me page. It is
  a plain, user-initiated outbound link — clicking it opens PayPal in a new
  tab. The extension never collects, handles, or transmits any payment
  information itself.

## Permissions

- `storage` — to save your encrypted vault locally.
- `activeTab` — to autofill the page you're currently on, only when you
  explicitly ask.
- Access to page content on http(s) pages — to detect login forms for the
  save-prompt and to perform autofill, both described above and both
  entirely local.

## Data deletion

Your vault is deleted the moment you uninstall the extension (Chrome
removes its storage), or immediately if you use "Reset this vault" in the
locked-vault screen. There is no copy anywhere else to delete, because
none was ever made.

## Children's privacy

Vaultly is not directed at children and does not knowingly collect any
information from anyone, of any age — see above: it does not collect
information at all.

## Changes to this policy

If this policy changes, the updated version will be posted at this same
URL with a new effective date. Given the extension has nothing to collect
by design, changes are expected to be rare and cosmetic rather than
substantive.

## Contact

Questions about this policy can be raised via a GitHub issue on this
repository: <https://github.com/HarutoSora/vaultly>.
