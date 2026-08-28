# Cryptography

Vaultly is built on a zero-knowledge architecture: the server stores and
transports ciphertext it cannot read. Every step described here happens
**client-side**, in the browser (`frontend/src/lib/crypto.ts`) or the
extension, using established primitives only — Argon2id (via
[`hash-wasm`](https://www.npmjs.com/package/hash-wasm), a WASM build of the
reference implementation) and AES-GCM/HMAC via the browser's native
[WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
Nothing here is hand-rolled.

## The chain

```
Master Password
      │
      │  Argon2id(password, per-user salt)
      ▼
Key Encryption Key (KEK)  ── 256-bit, lives in memory only, never transmitted
      │
      ├── HMAC-SHA256(key=KEK, "vaultly-login-proof:" + email)
      │         │
      │         ▼
      │   Login Proof ──────────────► sent to the server for authentication
      │
      └── AES-256-GCM(key=KEK) encrypts/decrypts ──┐
                                                     ▼
                                    Vault Encryption Key (VEK)
                                    256-bit, random, generated once at
                                    registration. Stored server-side only
                                    in its KEK-encrypted form (the
                                    "protected vault key").
                                                     │
                                                     │  AES-256-GCM(key=VEK)
                                                     ▼
                                    Encrypted Vault (every item, every
                                    folder name)
```

### 1. Master Password → Key Encryption Key (KEK)

The client derives a 256-bit key from the master password using **Argon2id**:

- Salt: a random 16-byte value generated at registration and stored
  server-side (salts aren't secret — they only need to be unique and
  unpredictable, and the server must be able to hand them back to any device
  logging in).
- Parameters: 64 MiB memory, 3 iterations, parallelism 1 by default —
  comfortably above the [OWASP-recommended minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)
  for a client-side KDF. The server independently rejects registration/login
  parameters below that minimum (`AuthService.ValidateKdfParams`), so a
  compromised or buggy client can never downgrade its own KDF strength.
- The KEK never leaves the device and is never persisted to disk — it lives
  in a JS variable for the duration of deriving/decrypting the VEK, then goes
  out of scope.

### 2. KEK → Login Proof

The server needs a way to verify the master password without ever seeing it
— or the KEK. The client computes:

```
loginProof = base64(HMAC-SHA256(key = KEK, message = "vaultly-login-proof:" + normalizedEmail))
```

HMAC is a one-way pseudorandom function: knowing `loginProof` gives no
practical way to recover `KEK`. This is the only value derived from the
master password that ever crosses the network. The server re-hashes it again
server-side with its own Argon2id pass before storing it
(`Argon2ServerPasswordHasher`) — defense in depth against a stolen database,
since `loginProof`'s effective entropy is still bounded by the master
password's.

### 3. KEK → Vault Encryption Key (VEK)

At registration, the client generates a random 256-bit **Vault Encryption
Key** — this is the key that actually protects vault data. It's encrypted
with the KEK using AES-256-GCM (a fresh random 96-bit nonce per encryption)
and the result — ciphertext + nonce, both opaque to the server — is what
gets stored as the user's "protected vault key."

On every login (or unlock, after a reload/idle-lock), the client:

1. Fetches the protected vault key blob and the account's KDF parameters.
2. Re-derives the KEK from the freshly-entered master password.
3. Decrypts the VEK with the KEK. AES-GCM is authenticated encryption — an
   incorrect master password produces an incorrect KEK, and decryption
   **fails loudly** (an `OperationError`) rather than silently returning
   garbage. This is how master-password verification for unlocking works;
   no separate check is needed.

The VEK lives in memory for the session (`SessionProvider` in
`frontend/src/lib/session.tsx`) and is explicitly zeroed (`.fill(0)`) on
lock/sign-out, best-effort — JS can't guarantee memory is scrubbed, but there's
no reason not to try.

### 4. VEK → Encrypted Vault

Every vault item's fields (name, username, password, notes, card number,
etc.) are serialized to JSON and encrypted as a single blob with
AES-256-GCM under the VEK, again with a fresh random nonce per encryption.
Folder names are encrypted the same way. The server stores ciphertext +
nonce + a small integer encryption-format version per item/folder, plus
non-sensitive metadata needed for listing and filtering (item type,
favorite flag, folder ID, timestamps) — see `docs/architecture.md` for the
exact schema and why that split is safe.

## What the server can and cannot do

The server **can**:
- Authenticate a login proof.
- Store and return ciphertext blobs.
- Enforce ownership (a user can only read/write their own rows).
- Bound the *size* of what it stores (a max ciphertext length, to prevent
  abuse) without ever looking inside it.

The server **cannot**:
- Recover a master password, a KEK, or a VEK from anything it stores.
- Decrypt a vault item, a folder name, or the protected vault key.
- Distinguish a real registered email from an unregistered one via the
  prelogin endpoint — unknown emails get a deterministic decoy KDF response
  of the same shape (`AuthService.GetPreloginParamsAsync`), so the endpoint
  can't be used to enumerate accounts.

## Versioning

Every encrypted blob carries an `encryptionVersion` integer (currently `1`
everywhere: AES-256-GCM, 96-bit random nonce, base64 encoding). If the
scheme ever needs to change — a different cipher, a different KDF — new data
gets written with a new version number, and a migration path re-encrypts old
data under the new scheme during an online re-key rather than an in-place
format change. No blob is ever silently reinterpreted under a scheme it
wasn't written with.

## Password generator

Generated entirely client-side (`frontend/src/lib/password-generator.ts`)
using `crypto.getRandomValues` — never `Math.random()` — with rejection
sampling so every selected character type is uniformly distributed rather
than biased toward the low end of the byte range.
