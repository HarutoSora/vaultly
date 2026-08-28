/**
 * MV3 service worker — the only place in the extension that ever holds the
 * Vault Encryption Key (either kind — see `Session` below). The popup and
 * content scripts never see it; they only ever exchange messages with this
 * worker and get back already-decrypted data (for display) or a plain
 * ok/error result.
 * <para/>
 * Caveat: a service worker can be terminated by the browser at any time
 * when idle, which drops this in-memory session — the next popup open (or
 * content-script message) then reports "locked" and the user re-enters
 * their master password. This is the same trade-off every MV3 password
 * manager extension makes; there is no durable place to keep a decryption
 * key that isn't itself an unencrypted secret at rest.
 * <para/>
 * Two independent vault kinds, chosen per-unlock, never merged:
 *  - "local": no account, no server, no network at all — see local-vault.ts.
 *    IndexedDB (this device only) via chrome.storage.local for the wrapped
 *    key + Argon2id/AES-256-GCM, same crypto as server mode.
 *  - "server": the original account-backed vault via the Vaultly API,
 *    synced across devices, backed by the web app / backend / SQL Server.
 * Both can exist on the same browser at once; whichever the user last
 * unlocked from is what's active until locked.
 */
import {
  type LoginItemData,
  VaultItemType,
  decryptJson,
  encryptJson,
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  setApiBaseUrl,
  unlockVault,
  vaultItemsApi,
} from '@vaultly/shared'
import type { BackgroundRequest, MatchingLogin, StatusResponse } from './messages'
import { matchesOrigin } from './origin-match'
import * as localVault from './local-vault'

// Goes through the same nginx that serves the web app (see
// frontend/nginx.conf) rather than the API container's own exposed port —
// that keeps this on the exact origin the session cookie is scoped to.
// Only ever contacted for server-mode actions; local mode makes no network
// calls at all (see getStatus below).
setApiBaseUrl('https://local.passwordvault.com/api')

type Session =
  | { kind: 'server'; userId: string; email: string; vek: Uint8Array }
  | { kind: 'local'; vek: Uint8Array }
  | null

let session: Session = null
let knownEmail: string | null = null

chrome.storage.local.get('lastEmail').then((r) => {
  knownEmail = (r.lastEmail as string | undefined) ?? null
})

async function getStatus(): Promise<StatusResponse> {
  const hasLocalVault = await localVault.isSetUp()

  if (session) {
    return {
      status: 'unlocked',
      mode: session.kind,
      email: session.kind === 'server' ? session.email : null,
      hasLocalVault,
    }
  }

  if (hasLocalVault) {
    // Never touch the network once a local vault exists — a local-only
    // user should never depend on any server being reachable at all, even
    // just to check. "Sign in with an account instead" (server mode) is
    // still reachable from the locked screen; it just isn't pre-checked here.
    return { status: 'locked', mode: 'local', email: null, hasLocalVault: true }
  }

  const me = await fetchCurrentUser()
  if (me) {
    knownEmail = me.email
    return { status: 'locked', mode: 'server', email: me.email, hasLocalVault: false }
  }

  return { status: 'no-vault', mode: null, email: null, hasLocalVault: false }
}

async function handleLogin(email: string, password: string): Promise<void> {
  const result = await apiLogin(email, password, 'Browser Extension')
  session = { kind: 'server', userId: result.userId, email: result.email, vek: result.vaultEncryptionKey }
  knownEmail = result.email
  await chrome.storage.local.set({ lastEmail: result.email })
}

async function handleUnlock(password: string): Promise<void> {
  const vek = await unlockVault(password)
  const me = await fetchCurrentUser()
  if (!me) throw new Error('Not signed in.')
  session = { kind: 'server', userId: me.userId, email: me.email, vek }
}

async function handleSetupLocalVault(password: string): Promise<void> {
  const vek = await localVault.setup(password)
  session = { kind: 'local', vek }
}

async function handleUnlockLocalVault(password: string): Promise<void> {
  const vek = await localVault.unlock(password)
  session = { kind: 'local', vek }
}

async function handleResetLocalVault(): Promise<void> {
  if (session?.kind === 'local') {
    session.vek.fill(0)
    session = null
  }
  await localVault.reset()
}

function handleLock(): void {
  session?.vek.fill(0)
  session = null
}

async function handleSignOut(): Promise<void> {
  const wasServerSession = session?.kind === 'server'
  handleLock()
  if (wasServerSession) {
    try {
      await apiLogout()
    } finally {
      knownEmail = null
      await chrome.storage.local.remove('lastEmail')
    }
  }
}

function requireSession(): NonNullable<Session> {
  if (!session) throw new Error('Vault is locked.')
  return session
}

async function listAllDecryptedLogins(): Promise<MatchingLogin[]> {
  const s = requireSession()

  if (s.kind === 'local') {
    return localVault.listItems(s.vek)
  }

  const items = await vaultItemsApi.list(false)
  const logins: MatchingLogin[] = []
  for (const item of items) {
    if (item.type !== VaultItemType.Login) continue
    const data = await decryptJson<LoginItemData>(
      { ciphertext: item.dataCiphertext, nonce: item.dataNonce },
      s.vek,
    )
    logins.push({ id: item.id, data })
  }
  return logins
}

async function listLoginsForOrigin(origin: string): Promise<MatchingLogin[]> {
  const all = await listAllDecryptedLogins()
  return all.filter((l) => l.data.website && matchesOrigin(l.data.website, origin))
}

async function createLogin(data: LoginItemData): Promise<void> {
  const s = requireSession()

  if (s.kind === 'local') {
    await localVault.createItem(s.vek, data)
    return
  }

  const blob = await encryptJson(data, s.vek)
  await vaultItemsApi.create({
    type: VaultItemType.Login,
    favorite: false,
    folderId: null,
    dataCiphertext: blob.ciphertext,
    dataNonce: blob.nonce,
  })
}

async function updateLogin(id: string, data: LoginItemData): Promise<void> {
  const s = requireSession()

  if (s.kind === 'local') {
    await localVault.updateItem(s.vek, id, data)
    return
  }

  // Preserve favorite/folder — this item may have been organized from the
  // web app, and this popup has no UI for either, so it must not silently
  // clear them on a password-only edit.
  const existing = await vaultItemsApi.get(id)
  const blob = await encryptJson(data, s.vek)
  await vaultItemsApi.update(id, {
    favorite: existing.favorite,
    folderId: existing.folderId,
    dataCiphertext: blob.ciphertext,
    dataNonce: blob.nonce,
  })
}

/**
 * Permanent in both modes — the popup has no trash/undo UI (unlike the web
 * app's Trash), so "delete" here means delete. Local mode has nowhere else
 * for a soft-deleted row to go without one; server mode intentionally
 * matches that rather than being subtly different depending on which
 * surface you're deleting from.
 */
async function deleteLogin(id: string): Promise<void> {
  const s = requireSession()

  if (s.kind === 'local') {
    await localVault.purgeItem(id)
    return
  }

  await vaultItemsApi.purge(id)
}

/** True only when we can positively confirm this exact origin+username isn't already saved — never prompts on a locked vault, since we can't check. */
async function shouldPromptToSave(origin: string, username: string): Promise<boolean> {
  if (!session) return false
  const matches = await listLoginsForOrigin(origin)
  return !matches.some((m) => m.data.username === username)
}

type AnyMessage =
  | BackgroundRequest
  | { type: 'LOGIN_FORM_SUBMITTED'; origin: string; username: string; password: string }

async function handleMessage(message: AnyMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATUS':
      return getStatus()
    case 'LOGIN':
      await handleLogin(message.email, message.password)
      return null
    case 'UNLOCK':
      await handleUnlock(message.password)
      return null
    case 'SETUP_LOCAL_VAULT':
      await handleSetupLocalVault(message.password)
      return null
    case 'UNLOCK_LOCAL_VAULT':
      await handleUnlockLocalVault(message.password)
      return null
    case 'RESET_LOCAL_VAULT':
      await handleResetLocalVault()
      return null
    case 'LOCK':
      handleLock()
      return null
    case 'SIGN_OUT':
      await handleSignOut()
      return null
    case 'LIST_LOGINS_FOR_ORIGIN':
      return listLoginsForOrigin(message.origin)
    case 'LIST_ALL_LOGINS':
      return listAllDecryptedLogins()
    case 'SAVE_LOGIN':
      await createLogin(message.data)
      return null
    case 'CREATE_LOGIN':
      await createLogin(message.data)
      return null
    case 'UPDATE_LOGIN':
      await updateLogin(message.id, message.data)
      return null
    case 'DELETE_LOGIN':
      await deleteLogin(message.id)
      return null
    case 'LOGIN_FORM_SUBMITTED':
      return { shouldPrompt: await shouldPromptToSave(message.origin, message.username) }
  }
}

chrome.runtime.onMessage.addListener((message: AnyMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }))
  return true // keep the message channel open for the async response above
})
