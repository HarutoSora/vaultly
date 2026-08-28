# Architecture

## Repository layout

```
PasswordVault/
  backend/                 .NET solution
    src/
      PasswordVault.Domain          entities, enums — no dependencies
      PasswordVault.Application     DTOs, service interfaces + implementations,
                                     repository interfaces — depends on Domain only
      PasswordVault.Infrastructure  EF Core, Argon2id hasher, token generator,
                                     email sender — implements Application's interfaces
      PasswordVault.Api             controllers, auth handler, middleware,
                                     Program.cs wiring — the only project that
                                     knows about HTTP
    tests/
      PasswordVault.Tests           unit tests (in-memory fakes) + a handful of
                                     real-SQL-Server integration tests
  frontend/                 React + TypeScript web app (Vite)
  extension/                 Chrome MV3 extension (Vite, 3 build targets)
  packages/
    shared/                 crypto, password generator, API client, DTOs —
                             used by both frontend and extension
  docs/                     this file, cryptography.md
  SECURITY.md
```

`frontend`, `extension`, and `packages/shared` are npm workspaces (`package.json` at
the repo root) — one `npm install` at the root links all three together, and
`@vaultly/shared` is imported by name from either app with no build step of
its own (Vite compiles its TypeScript source directly).

## Backend: layer responsibilities

**Domain** — plain C# classes (`User`, `Session`, `Device`, `Folder`,
`VaultItem`, `AuditEvent`) and enums. No EF Core attributes, no ASP.NET
Core, no `[Authorize]`, nothing. This is what would survive if the
database or the web framework were swapped out entirely.

**Application** — the actual business rules: `AuthService`, `VaultItemService`,
`FolderService`. Each depends only on repository *interfaces*
(`IUserRepository`, `IVaultItemRepository`, ...) defined in
`Application/Abstractions`, never on EF Core directly — which is what makes
`test/PasswordVault.Tests/Auth/AuthServiceTests.cs` etc. able to run against
plain in-memory fakes (`Tests/Fakes/`) with no database at all. Validation,
lockout policy, KDF parameter bounds, and the zero-knowledge invariants
("never log a plaintext password") all live here.

**Infrastructure** — `VaultDbContext` and the EF Core repository
implementations, `Argon2ServerPasswordHasher`, `SecureTokenGenerator`, and
two `IEmailSender` implementations — `SmtpEmailSender` (real delivery via
MailKit, used when `Email:Host` is configured) and `LoggingEmailSender`
(the zero-config fallback that just logs the code). This is the only layer
that knows SQL Server exists.

**Api** — thin controllers that map HTTP requests to Application calls,
`SessionCookieAuthHandler` (the custom auth scheme — see below),
`ExceptionHandlingMiddleware` (translates `AppException` subtypes to the
right HTTP status, and makes sure nothing else ever leaks a stack trace to
a client), rate limiting and CORS policy, `Program.cs`.

## Why a custom session-cookie auth handler instead of ASP.NET Identity's cookie auth

The built-in cookie authentication middleware encrypts a *ticket* into the
cookie itself via Data Protection — there's no server-side session record to
revoke. This app wants classic, revocable, server-side sessions (so
"sign out of all devices" and lockout actually work), with only a
SHA-256 hash of the session token ever touching the database — so
`SessionCookieAuthHandler` (`Api/Auth/`) is a small custom
`AuthenticationHandler` that reads the `pv_session` cookie, hashes it, and
asks `IAuthService.ValidateSessionAsync` to resolve it against the
`Sessions` table. This is less code than properly reconfiguring the
built-in cookie handler for this model would have been, not more.

## Extending the domain later

The features intentionally **not** built in this MVP (mobile apps, teams,
sharing, passkeys, secure sharing, subscription billing, breach monitoring)
were named up front so the plumbing wouldn't have to be reworked to make
room for them:

- **Multi-device sync already works** — `Session`/`Device` are already
  separate entities; a native mobile client is just another `IAuthService`
  consumer hitting the same REST API.
- **Sharing/teams** would add an `OrganizationId`/`VaultId` layer above the
  current per-user `VaultItem.UserId` — the encryption model would extend
  naturally (each shared vault gets its own VEK, itself encrypted once per
  member with that member's public key — the standard approach, requiring
  asymmetric crypto that isn't needed for a single-owner vault today).
- **TOTP/passkeys** are just another `VaultItemType`, and passkeys specifically
  are a new *authentication* method that would plug into
  `IAuthService`/`SessionCookieAuthHandler` alongside the existing
  password-proof login, not replace it.
- **Billing** would be a new bounded context (its own tables, its own
  service) that only needs to know a `UserId`, not touch vault data at all.

None of this is implemented — it's flagged here specifically because
"leave room for it" was a stated requirement, and the honest way to satisfy
that for an MVP is to point at *where* it plugs in, not to build unused
scaffolding today.

## Frontend structure

```
frontend/src/
  lib/
    session.tsx     SessionProvider — the one place the VEK lives in memory,
                     auto-lock timer, idle/visibility handling
    theme.tsx        light/dark/system, persisted preference
  components/ui/     hand-customized shadcn/Radix primitives (button, dialog,
                     select, ...) — see CLAUDE-style note: heavily
                     restyled against this app's own design tokens
                     (index.css `@theme`), not left at shadcn defaults
  components/        item-form-dialog, item-detail-panel, secret-value,
                     sidebar-nav, ...
  hooks/use-vault.ts  TanStack Query for the encrypted list + a decrypt
                     pass in a `useEffect`, exposed as one hook per
                     screen needs (`useDecryptedVaultItems`, mutations)
  pages/              route-level components, lazy-loaded (see App.tsx)
```

State management is deliberately plain: React Context for session/theme
(global, small, changes rarely), TanStack Query for server data (the
encrypted item/folder lists), local `useState` everywhere else. No Redux,
no Zustand — nothing here needed it.

## Extension structure

Three independent Vite build targets sharing one `dist/` folder (see
`extension/package.json`'s `build` script and the three `vite.*.config.ts`
files) because a service worker, a content script, and a popup page each
have different bundling requirements (self-contained ES module,
self-contained IIFE, and a normal multi-asset page, respectively).

`background.ts` (the service worker) is the only place in the extension
that ever holds the Vault Encryption Key — the popup and content script
only exchange messages with it (`extension/src/messages.ts` defines the
protocol) and never see key material directly.
