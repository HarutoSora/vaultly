# Submitting the extension to the Chrome Web Store

The extension has a dedicated build variant for this — `npm run build:store`
inside `extension/` — which strips account/sync mode entirely (no
`host_permissions`, no code path that ever contacts a server) so the
published extension is a fully self-contained product with nothing to
host. The regular `npm run build` (dual-mode: local vault + account
sync, pointed at `local.passwordvault.com`) is for local development
only and must never be the one submitted.

## What's already done

- [x] Manifest V3.
- [x] `build:store` produces a manifest with no `host_permissions` and an
      accurate description (`extension/scripts/patch-store-manifest.mjs`).
- [x] No remote-hosted code — the WASM Argon2id dependency is bundled
      (`'wasm-unsafe-eval'` in the CSP, not a remote script fetch).
- [x] Privacy policy written: [`docs/privacy-policy.md`](privacy-policy.md).
      GitHub renders `.md` files at a stable public URL for a public repo —
      e.g. `https://github.com/HarutoSora/vaultly/blob/main/docs/privacy-policy.md`
      — which is enough to satisfy the Developer Dashboard's privacy policy
      URL field. A dedicated page (GitHub Pages, etc.) works too, if a nicer
      URL is wanted.

## What's still needed before submitting

- [ ] **$5 one-time Chrome Web Store developer registration fee** — paid by
      whoever's Google account owns the listing. Not something this repo or
      any tooling can do; go to
      <https://chrome.google.com/webstore/devconsole> and register.
- [ ] **Store listing assets**: a 128×128 icon (already have one —
      `extension/public/icons/icon-128.png`), at least one screenshot
      (1280×800 or 640×400), and a short + detailed description. The
      privacy-policy summary above can seed the detailed description.
- [ ] **Single-purpose justification**: the dashboard asks why the
      extension needs access to all sites — answer is autofill + login-form
      detection, both described in the privacy policy.
- [ ] **Build and zip the store variant**:
      ```bash
      cd extension
      npm run build:store
      cd dist && zip -r ../vaultly-store.zip .
      ```
      Upload `vaultly-store.zip` to the dashboard.
- [ ] **A final manual smoke test of the store build specifically** —
      load `extension/dist` (after `build:store`, not `build`) via
      `chrome://extensions` → Load unpacked, and confirm: first run goes
      straight to vault creation (no "sign in with account" option
      anywhere), and there's no reference to `local.passwordvault.com` in
      the manifest (`extension/dist/manifest.json`).

## If account/sync mode ever gets a real public backend

At that point `build:store` could be revisited to include it — the
`__STORE_BUILD__` flag (see `vite.popup.config.ts` / `vite.background.config.ts`
/ `docs/architecture.md`) is a single switch, not a fork, so re-enabling
account mode for the store build is a matter of pointing
`setApiBaseUrl(...)` at the real backend and removing the `__STORE_BUILD__`
guards, not rewriting anything.
