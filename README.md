<div align="center">

# 🔐 Vaultly

### A zero-knowledge password manager

*The server stores ciphertext it cannot read. Every encryption and decryption happens in your browser — never on the backend.*

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SQL Server](https://img.shields.io/badge/SQL_Server-EF_Core-CC2927?style=for-the-badge&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![Tests](https://img.shields.io/badge/tests-96%20passing-39d353?style=for-the-badge&logo=vitest&logoColor=white)](#-testing)
[![Zero Knowledge](https://img.shields.io/badge/encryption-Argon2id%20%2B%20AES--256--GCM-7c74ff?style=for-the-badge&logo=letsencrypt&logoColor=white)](docs/cryptography.md)

</div>

<br/>

> Vaultly was built as a **small, secure core**, not a feature dump — the
> architecture intentionally leaves room for mobile apps, teams, sharing,
> passkeys, and billing later without a rewrite. See
> [`docs/architecture.md`](docs/architecture.md#extending-the-domain-later)
> for exactly where each of those plugs in.

## Contents

- [What's here](#whats-here)
- [Features](#-features)
- [How the encryption works](#-how-the-encryption-works)
- [Running it locally](#-running-it-locally)
- [Docker](#-docker)
- [Testing](#-testing)
- [Security](#-security)
- [Design system](#-design-system)
- [Project structure](#-project-structure)

## What's here

A password manager built the way a real one has to be: the master password
never leaves your device, the server never sees a decryption key, and
every layer — backend, web app, browser extension — is built to prove that,
not just claim it.

| Piece | Stack |
|---|---|
| `backend/` | C# / ASP.NET Core Web API · EF Core · SQL Server — `Domain → Application → Infrastructure → Api` |
| `frontend/` | React 19 · TypeScript · Tailwind CSS v4 · Radix UI (hand-customized) · TanStack Query · React Hook Form + Zod · Motion |
| `extension/` | Chrome MV3 — background service worker, content script, popup |
| `packages/shared/` | The crypto module, password generator, and API client — imported by name (`@vaultly/shared`) from both the web app and the extension, so there's exactly **one** implementation of the security-critical code |

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

**🔑 Vault**
- Logins, Secure Notes, and Credit Cards
- Folders, favorites, relevance-ranked search by name, username, *or* link
- Real site favicons next to each login — fetched directly from the site itself, not a third-party favicon API that would see your whole domain list in one request
- Soft-delete to Trash → restore or purge permanently
- Optimistic-concurrency safe — two devices editing the same item at once get a clean conflict, never a silent overwrite

**📥 Import from Chrome**
- Chrome has no API for any extension to read its saved passwords — that's deliberate on Chrome's part. Vaultly instead imports the CSV file Chrome lets *you* export yourself, parsed and encrypted entirely client-side.

**🧩 Browser extension**
- Detects login forms on any site
- Autofills only when the saved item's hostname **exactly** matches the page — no fuzzy matching, no subdomain generalization
- Offers to save a new login after you sign into a site it doesn't recognize
- Built-in generator, lock/unlock, "open web vault"

</td>
<td width="50%" valign="top">

**🛡️ Security-first UX**
- Every secret masked by default — explicit Show, one-click Copy with its own confirmation, never echoed into a toast or a URL
- Auto-lock on a configurable idle timeout, or instantly when the tab is hidden
- No password reset, by design — see [Security](#-security) for why that's not an oversight

**🎲 Password generator**
- Length, character-set toggles, live strength meter
- `crypto.getRandomValues` only — never `Math.random()`

**🎨 Interface**
- Light / dark / system theme
- Built against a real design-token system, not shadcn's defaults

</td>
</tr>
</table>

## 🔒 How the encryption works

```
Master Password
      │  Argon2id (64 MiB, 3 iterations — client-side, in your browser)
      ▼
Key Encryption Key (KEK)  ── lives in memory only, never transmitted
      │
      ├── HMAC-SHA256(KEK, email)  →  Login Proof  ──────────► sent to the server
      │      (a one-way value — the server can verify it without ever learning KEK)
      │
      └── AES-256-GCM(KEK) encrypts ──┐
                                       ▼
                        Vault Encryption Key (VEK)
                        random, generated once, stored server-side
                        only in its encrypted form
                                       │
                                       │  AES-256-GCM(VEK)
                                       ▼
                        Every vault item & folder name
```

A stolen database yields ciphertext and a login-proof hash — never a
master password, a key, or a single decrypted vault item. The full
derivation, parameter choices, and versioning strategy are written up in
[`docs/cryptography.md`](docs/cryptography.md).

## 🚀 Running it locally

**Prerequisites:** .NET 10 SDK, Node 20+, a reachable SQL Server instance.

### 1. Backend

```bash
cd backend
dotnet tool install --global dotnet-ef   # once, if you don't have it
dotnet ef database update --project src/PasswordVault.Infrastructure --startup-project src/PasswordVault.Api
dotnet run --project src/PasswordVault.Api
```

Adjust `ConnectionStrings:VaultDatabase` in
`backend/src/PasswordVault.Api/appsettings.json` if your SQL Server isn't a
local, Windows-auth, `localhost` instance. The API listens on
`https://localhost:5201` — run it with `ASPNETCORE_ENVIRONMENT=Development`
to auto-apply migrations on startup and enable `/openapi`.

Verification emails only send for real once SMTP is configured (`.env` —
see the [Docker](#-docker) section); without that, the code is just logged
to the console (`[DEV EMAIL] ...`) when you register — see
[Security](#-security).

### 2. Frontend

```bash
cd frontend
npm install       # from the repo root instead, if you also want the extension — see below
npm run dev
```

Open `https://localhost:5173`. First run provisions a locally-trusted dev
HTTPS cert (`vite-plugin-mkcert`) — the session cookie is `Secure`, so
plain HTTP can't carry it. In a sandboxed shell where that can't prompt
interactively: `VAULTLY_NO_HTTPS=1 npm run dev` (renders fine, sign-in
won't fully work).

### 3. Extension (optional)

Shares code with the frontend via an npm workspace, so install from the
**repo root**:

```bash
npm install        # from the repo root
cd extension && npm run build
```

Chrome → `chrome://extensions` → enable Developer mode → **Load unpacked**
→ select `extension/dist`. Sign in via the web app first — the extension
unlocks an existing session rather than registering a new one.

## 🐳 Docker

The whole stack — SQL Server, the API, and the frontend (nginx serving the
production build, terminating HTTPS, reverse-proxying `/api` to the API
container) — runs in Docker, and this is the recommended way to keep
Vaultly running continuously on a machine rather than in a terminal you
have to keep open.

```bash
# One-time: point local.passwordvault.com at your own machine (needs an
# elevated/admin shell — this file is outside what a normal process can write):
Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" -Value "127.0.0.1 local.passwordvault.com"

# One-time: the frontend needs a locally-trusted TLS cert covering that
# hostname (the Secure session cookie requires HTTPS). If you've already
# run `npm run dev` once (vite-plugin-mkcert installed a CA), reuse it:
mkdir -p frontend/certs
CAROOT="$HOME/.vite-plugin-mkcert" "$HOME/.vite-plugin-mkcert/mkcert.exe" \
  -cert-file frontend/certs/cert.pem -key-file frontend/certs/key.pem \
  local.passwordvault.com localhost 127.0.0.1 ::1
# (CAROOT matters — without it mkcert creates a brand-new, untrusted CA
# instead of reusing the one already in your OS trust store.)

# Optional: enable real verification emails instead of console-logged codes.
cp .env.example .env
# then edit .env — see its comments for how to get a Gmail App Password

docker compose up -d --build

# Then, once (and again after any future migration): apply migrations
# against the containerized database.
cd backend
dotnet ef database update --project src/PasswordVault.Infrastructure --startup-project src/PasswordVault.Api \
  --connection "Server=localhost,1433;Database=PasswordVaultDb;User Id=sa;Password=Ch4ngeMe!ForRealDeployments;TrustServerCertificate=True;"
```

Then open **`https://local.passwordvault.com`** — no port needed, it's
mapped to standard 443/80. Every service has `restart: unless-stopped`, so
Docker brings them back after a crash or a host reboot — as long as Docker
Desktop itself is running. To make that automatic too:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-startup.ps1
```

This adds one small launcher to your Windows Startup folder that starts
Docker Desktop at every log on (no admin rights needed — it's a plain file
copy, not a system service or scheduled task). Remove it with
`scripts\uninstall-startup.ps1`.

Replace the placeholder SA password (`docker-compose.yml`) before deploying
anywhere that isn't your own machine — see its comments for exactly what to
change and why migrations are a deliberate manual step rather than
automatic on container boot.

## 🧪 Testing

96 automated tests across three languages/runtimes, plus a full manual
browser walkthrough against the real API and database (register → verify
→ login → create/copy/trash a vault item → generator → theme) before this
was called done.

```bash
# Backend — 43 tests: unit tests against in-memory fakes, plus real-SQL-Server
# integration tests for unique constraints, cascade deletes, and concurrency conflicts.
cd backend && dotnet test

# Shared crypto/password-generator/CSV-import/favicon — 42 tests, pure functions, no server needed.
cd packages/shared && npm test

# Extension's autofill domain-matching — 11 tests (the boundary that decides
# whether a credential can leak to the wrong site).
cd extension && npm test

# Frontend type-check + production build
cd frontend && npx tsc -b && npm run build
```

## 🛡️ Security

Full writeup, including honestly-disclosed limitations, in
[`SECURITY.md`](SECURITY.md). The short version:

- Master password never crosses the network — only a one-way HMAC proof does.
- Sessions are server-side and revocable (hashed tokens, not encrypted tickets) — "sign out of all devices" actually works.
- Rate-limited + account-lockout login, deterministic decoys on the prelogin endpoint (no account enumeration).
- `HttpOnly` + `Secure` + `SameSite=Strict` cookies, HSTS, a locked-down CSP, allow-listed CORS.
- Every vault query is scoped to the authenticated user at the repository layer — tested explicitly, including against a real database.
- Email delivery is opt-in via SMTP (`.env.example`) — configure it or the app just logs verification codes instead. No CI pipeline is wired up yet — flagged, not hidden.

## 🌈 Design system

Dark-first (with light/system-auto), one restrained indigo accent, Inter
for UI text and JetBrains Mono for anything read character-by-character —
passwords, card numbers. Tokens live in `frontend/src/index.css` (`@theme`);
every component in `frontend/src/components/ui/` is built against them, not
left at shadcn's defaults.

## 📁 Project structure

```
vaultly/
├─ backend/                 .NET solution (Domain → Application → Infrastructure → Api)
├─ frontend/                React web vault
├─ extension/               Chrome MV3 extension
├─ packages/shared/         crypto, password generator, API client — shared by frontend + extension
├─ docs/
│  ├─ architecture.md       layer responsibilities, why a custom auth handler, how to extend
│  └─ cryptography.md       the full derivation chain, parameter choices, versioning
├─ docker-compose.yml       API + SQL Server for local/self-hosted deployment
└─ SECURITY.md              threat model, what's implemented, known limitations
```

<br/>

<div align="center">
<sub>Built as a small, genuinely secure core — not a feature dump.</sub>
</div>
