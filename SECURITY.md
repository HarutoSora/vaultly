# Security

Vaultly is a password manager — its threat model is "assume the server
gets breached" as a baseline, not an edge case. This document is the honest
account of what's actually implemented, not an aspirational one.

For the cryptographic design specifically (Argon2id, AES-256-GCM, the full
derivation chain), see [`docs/cryptography.md`](docs/cryptography.md).
For how the pieces fit together, see [`docs/architecture.md`](docs/architecture.md).

## Reporting a vulnerability

This is a personal/portfolio project without a formal disclosure program.
If you find an issue, open a private security advisory on the repository
(GitHub → Security → Advisories) rather than a public issue.

## What's implemented

**Zero-knowledge encryption.** The server never has the master password,
the Key Encryption Key, or the Vault Encryption Key, and cannot decrypt
vault contents — see `docs/cryptography.md` for the exact chain. This is
the single most load-bearing security property of the whole app: a full
database compromise still doesn't hand an attacker anyone's passwords.

**Authentication**
- The master password itself never crosses the network — only a
  derived, non-reversible login proof (`crypto.ts` → `deriveLoginProof`).
- Server-side, that proof is re-hashed with Argon2id before storage
  (`Argon2ServerPasswordHasher`) — defense in depth against a stolen
  database being used to brute-force weak master passwords.
- Failed logins are rate-limited per account (10 attempts → 15-minute
  lockout, `AuthService`) *and* per IP at the HTTP layer (`Program.cs`'s
  `"auth"` rate-limiter policy, 10 requests/minute).
- The `/auth/prelogin` endpoint returns a deterministic decoy for
  unregistered emails so it can't be used to enumerate accounts.
- Sessions are server-side and revocable: the cookie holds a random token,
  only its SHA-256 hash is stored, and "sign out of all devices" actually
  invalidates every session row.

**Session cookie**
- `HttpOnly` (inaccessible to page JavaScript, including a successful XSS —
  see below), `Secure` (HTTPS-only), `SameSite=Strict`.
- `SameSite=Strict` is this app's CSRF defense: a state-changing request
  from another origin simply never carries the cookie, which is a
  simpler and at least as strong guarantee as a separate anti-CSRF token
  for an app with no need to accept cross-site authenticated requests.

**Transport & headers** (`SecurityHeadersMiddleware`, `Program.cs`)
- HSTS in non-development environments.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, a restrictive `Content-Security-Policy`,
  a locked-down `Permissions-Policy`.
- CORS is a specific allow-listed origin with credentials, not a wildcard.

**Input handling**
- Every request DTO is validated server-side (`AuthService`,
  `VaultItemService`, `FolderService`) — email shape, KDF parameter bounds,
  ciphertext presence and a maximum size — independent of whatever the
  client already checked.
- SQL injection: not applicable by construction — every query goes through
  EF Core's parameterized LINQ, no raw SQL string concatenation anywhere in
  the codebase.
- XSS: React escapes all rendered text by default, and the frontend never
  uses `dangerouslySetInnerHTML` on anything a user or a webpage supplied.
  The one intentionally-injected HTML string is the extension's own static
  save-prompt template (`content-script.ts`), which contains no
  user-controlled or page-controlled data.

**Authorization**
- Every vault item / folder query and mutation is scoped by the
  authenticated user's ID at the repository layer — there is no code path
  that fetches a row by ID alone without also constraining `UserId`. Tested
  explicitly (`VaultItemServiceTests`, `FolderServiceTests` —
  "for another user's item/folder throws NotFound").
- Cross-user data isolation is also covered by a real-SQL-Server
  integration test (`EfIntegrationTests`), not just the in-memory fakes.

**Secrets never logged.** `AuditEvent` rows record event type, timestamp,
and IP only — never vault content, never a password, never a session
token. `LoggingEmailSender` only ever emits what would legitimately go in
an email (a verification code), nothing sensitive; `SmtpEmailSender` logs
even less — just the recipient and provider, never the code or body.
Reviewed as part of
finishing this pass — grep the codebase for `Console.Write`/`_logger.Log`
calls near anything password/session-shaped before adding a new one.

**Autofill safety (browser extension).** The content script only ever
matches and offers to fill credentials whose saved `website` hostname
equals `window.location.hostname` of the page it's running on — there is
no fuzzy or partial matching, and it never autofills without the user
explicitly clicking "Fill" in the popup for a specific, already
origin-filtered credential.

**Concurrency.** `VaultItem`/`User` carry an EF Core row-version
concurrency token, so two devices racing to edit the same record get a
clear 409 Conflict instead of one silently overwriting the other
(`UnitOfWork`, tested against real SQL Server in `EfIntegrationTests`).

## Known limitations

Said plainly, matching this project's own "don't claim it's done if it
isn't" rule:

- **Email delivery is opt-in via SMTP.** `SmtpEmailSender` (MailKit, tested
  with Gmail's SMTP + an account App Password — never a real account
  password) sends real verification emails once `Email:Host` is configured;
  see `.env.example` for the exact variables and where to get a Gmail App
  Password. Leave it unset and the app automatically falls back to
  `LoggingEmailSender`, which just logs the verification code to the
  server console instead — so it still works with zero email setup at all.
  Swapping in a different provider (SendGrid, SES, Postmark) is a second
  class behind the same `IEmailSender` interface.
- **No password-reset flow.** By design (a "reset" would require some way
  to re-derive or recover the Vault Encryption Key without the master
  password, which is exactly what zero-knowledge means can't exist) — but
  worth saying explicitly so it isn't mistaken for an oversight.
- **The extension's unlocked session lives in the service worker's memory**,
  which the browser can terminate at any time when idle — see the doc
  comment at the top of `extension/src/background.ts`.
- **No automated dependency/secret scanning is wired into CI** — there is
  no CI pipeline at all yet. Run `dotnet list package --vulnerable` and
  `npm audit` manually before a release.
- **HTTPS in local development** depends on `vite-plugin-mkcert`
  successfully installing a local CA into the OS trust store on first run,
  which needs an interactive environment — see the comment in
  `frontend/vite.config.ts` for the sandboxed-environment fallback.
