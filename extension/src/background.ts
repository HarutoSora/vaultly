/**
 * MV3 service worker — the only place in the extension that ever holds the
 * Vault Encryption Key. The popup and content scripts never see it; they
 * only ever exchange messages with this worker and get back either
 * already-decrypted data (for display) or a plain ok/error result.
 * <para/>
 * Caveat: a service worker can be terminated by the browser at any time
 * when idle, which drops this in-memory session — the next popup open (or
 * content-script message) then reports "locked" and the user re-enters
 * their master password. This is the same trade-off every MV3 password
 * manager extension makes; there is no durable place to keep a decryption
 * key that isn't itself an unencrypted secret at rest.
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

// TODO: point at the real deployed API origin for a production build.
setApiBaseUrl('https://localhost:5201/api')

interface Session {
  userId: string
  email: string
  vek: Uint8Array
}

let session: Session | null = null
let knownEmail: string | null = null

chrome.storage.local.get('lastEmail').then((r) => {
  knownEmail = (r.lastEmail as string | undefined) ?? null
})

async function getStatus(): Promise<StatusResponse> {
  if (session) return { status: 'unlocked', email: session.email }

  const me = await fetchCurrentUser()
  if (me) {
    knownEmail = me.email
    return { status: 'locked', email: me.email }
  }
  return { status: 'signed-out', email: knownEmail }
}

async function handleLogin(email: string, password: string): Promise<void> {
  const result = await apiLogin(email, password, 'Browser Extension')
  session = { userId: result.userId, email: result.email, vek: result.vaultEncryptionKey }
  knownEmail = result.email
  await chrome.storage.local.set({ lastEmail: result.email })
}

async function handleUnlock(password: string): Promise<void> {
  const vek = await unlockVault(password)
  const me = await fetchCurrentUser()
  if (!me) throw new Error('Not signed in.')
  session = { userId: me.userId, email: me.email, vek }
}

function handleLock(): void {
  session?.vek.fill(0)
  session = null
}

async function handleSignOut(): Promise<void> {
  try {
    await apiLogout()
  } finally {
    handleLock()
    knownEmail = null
    await chrome.storage.local.remove('lastEmail')
  }
}

function requireSession(): Session {
  if (!session) throw new Error('Vault is locked.')
  return session
}

async function listAllDecryptedLogins(): Promise<Array<MatchingLogin & { website: string }>> {
  const { vek } = requireSession()
  const items = await vaultItemsApi.list(false)
  const logins: Array<MatchingLogin & { website: string }> = []

  for (const item of items) {
    if (item.type !== VaultItemType.Login) continue
    const data = await decryptJson<LoginItemData>(
      { ciphertext: item.dataCiphertext, nonce: item.dataNonce },
      vek,
    )
    logins.push({ id: item.id, data, website: data.website })
  }

  return logins
}

async function listLoginsForOrigin(origin: string): Promise<MatchingLogin[]> {
  const all = await listAllDecryptedLogins()
  return all
    .filter((l) => l.website && matchesOrigin(l.website, origin))
    .map(({ id, data }) => ({ id, data }))
}

async function saveLogin(data: LoginItemData): Promise<void> {
  const { vek } = requireSession()
  const blob = await encryptJson(data, vek)
  await vaultItemsApi.create({
    type: VaultItemType.Login,
    favorite: false,
    folderId: null,
    dataCiphertext: blob.ciphertext,
    dataNonce: blob.nonce,
  })
}

/** True only when we can positively confirm this exact origin+username isn't already saved — never prompts on a locked/signed-out vault, since we can't check. */
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
    case 'LOCK':
      handleLock()
      return null
    case 'SIGN_OUT':
      await handleSignOut()
      return null
    case 'LIST_LOGINS_FOR_ORIGIN':
      return listLoginsForOrigin(message.origin)
    case 'SAVE_LOGIN':
      await saveLogin(message.data)
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
