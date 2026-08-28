// Runs after `vite build --mode store` (see package.json's build:store
// script). The three vite.*.config.ts builds strip the account/sync code
// paths at compile time via __STORE_BUILD__, but manifest.json is a static
// file copied verbatim from public/ — it still needs its own pass to remove
// the host_permissions entry that only server mode ever used, and to make
// the store listing's description match what the build actually does.
// Keeping this separate from public/manifest.json (rather than hand-editing
// two manifests) means there's exactly one manifest to keep in sync for
// every field except the two this script deliberately changes.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const manifestPath = fileURLToPath(new URL('../dist/manifest.json', import.meta.url))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

delete manifest.host_permissions

manifest.description =
  'Zero-knowledge password manager. Fully standalone: your vault is encrypted with your master password and stored only on this device — no account, no server, nothing to sync.'

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

console.log('Patched dist/manifest.json for the Chrome Web Store build (removed host_permissions).')
