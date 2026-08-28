/**
 * A fully standalone vault: no account, no email, no server, nothing to
 * host. The exact same crypto chain as server-backed mode (Argon2id -> KEK
 * -> AES-256-GCM-wrapped VEK -> AES-256-GCM item content, all from
 * @vaultly/shared) — the only thing that changes is where the encrypted
 * result lands: IndexedDB on this device (local-vault-db.ts) instead of a
 * POST to an API. There is no login proof and nothing is ever sent
 * anywhere; the KDF salt and protected-VEK blob (both meaningless without
 * the master password) live in chrome.storage.local alongside the vault.
 * <para/>
 * There is no recovery path. Forget the master password, or lose this
 * browser profile, and the vault is gone — by design, the same way losing
 * a server account's master password would be, just without an account to
 * fall back on at all.
 */
import {
  DEFAULT_KDF_PARAMS,
  type LoginItemData,
  VaultItemType,
  decryptJson,
  decryptVaultKey,
  deriveKeyEncryptionKey,
  encryptJson,
  encryptVaultKey,
  generateVaultEncryptionKey,
  randomSaltBase64,
} from '@vaultly/shared'
import * as db from './local-vault-db'

const META_KEY = 'localVaultMeta'

interface LocalVaultMeta {
  kdfSalt: string
  kdfMemoryKib: number
  kdfIterations: number
  kdfParallelism: number
  protectedVaultKeyCiphertext: string
  protectedVaultKeyNonce: string
}

export interface LocalLogin {
  id: string
  data: LoginItemData
}

async function readMeta(): Promise<LocalVaultMeta | undefined> {
  const result = await chrome.storage.local.get(META_KEY)
  return result[META_KEY] as LocalVaultMeta | undefined
}

export async function isSetUp(): Promise<boolean> {
  return (await readMeta()) !== undefined
}

export async function setup(masterPassword: string): Promise<Uint8Array> {
  if (await isSetUp()) {
    throw new Error('A local vault already exists on this device.')
  }
  if (masterPassword.length < 8) {
    throw new Error('Use at least 8 characters — this is the only thing protecting the vault.')
  }

  const kdfSalt = randomSaltBase64()
  const kdfParams = { kdfSalt, ...DEFAULT_KDF_PARAMS }
  const kek = await deriveKeyEncryptionKey(masterPassword, kdfParams)
  const vek = generateVaultEncryptionKey()
  const protectedKey = await encryptVaultKey(vek, kek)

  const meta: LocalVaultMeta = {
    ...kdfParams,
    protectedVaultKeyCiphertext: protectedKey.ciphertext,
    protectedVaultKeyNonce: protectedKey.nonce,
  }
  await chrome.storage.local.set({ [META_KEY]: meta })

  return vek
}

export async function unlock(masterPassword: string): Promise<Uint8Array> {
  const meta = await readMeta()
  if (!meta) {
    throw new Error('No local vault set up on this device.')
  }
  const kek = await deriveKeyEncryptionKey(masterPassword, meta)
  // AES-GCM is authenticated: a wrong password derives a wrong KEK, and
  // decryption throws rather than silently returning garbage — that failure
  // *is* the "wrong password" signal, same as server-mode unlock.
  return decryptVaultKey(
    { ciphertext: meta.protectedVaultKeyCiphertext, nonce: meta.protectedVaultKeyNonce },
    kek,
  )
}

/** Deletes the local vault entirely — the KDF/VEK metadata and every stored item. Irreversible; there is nothing else to fall back on. */
export async function reset(): Promise<void> {
  await chrome.storage.local.remove(META_KEY)
  await db.clearAll()
}

// ---- item CRUD --------------------------------------------------------

export async function listItems(vek: Uint8Array): Promise<LocalLogin[]> {
  const rows = await db.listItems()
  const active = rows.filter((r) => r.deletedAt === null)
  const items = await Promise.all(
    active.map(async (row) => ({
      id: row.id,
      data: await decryptJson<LoginItemData>({ ciphertext: row.dataCiphertext, nonce: row.dataNonce }, vek),
      updatedAt: row.updatedAt,
    })),
  )
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return items.map(({ id, data }) => ({ id, data }))
}

export async function createItem(vek: Uint8Array, data: LoginItemData): Promise<string> {
  const blob = await encryptJson(data, vek)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.putItem({
    id,
    type: VaultItemType.Login, // local mode only ever stores logins today
    favorite: false,
    folderId: null,
    dataCiphertext: blob.ciphertext,
    dataNonce: blob.nonce,
    encryptionVersion: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  return id
}

export async function updateItem(vek: Uint8Array, id: string, data: LoginItemData): Promise<void> {
  const existing = await db.getItem(id)
  if (!existing) {
    throw new Error('Item not found.')
  }
  const blob = await encryptJson(data, vek)
  await db.putItem({
    ...existing,
    dataCiphertext: blob.ciphertext,
    dataNonce: blob.nonce,
    updatedAt: new Date().toISOString(),
  })
}

/** Permanent — local mode has no trash/undo (see extension/src/background.ts for why). */
export async function purgeItem(id: string): Promise<void> {
  await db.deleteItem(id)
}
