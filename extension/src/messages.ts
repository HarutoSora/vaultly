import type { DecryptedVaultItem, LoginItemData } from '@vaultly/shared'

export type ExtensionMode = 'local' | 'server'

export type ExtensionStatus = 'loading' | 'no-vault' | 'locked' | 'unlocked'

export interface StatusResponse {
  status: ExtensionStatus
  /** Which vault the current status/session refers to. Null only when status is 'loading' or 'no-vault'. */
  mode: ExtensionMode | null
  /** Only meaningful for server mode. */
  email: string | null
  /** Whether a local vault already exists on this device, regardless of whether it's the active mode right now — drives whether the popup offers "unlock local vault" as an option. */
  hasLocalVault: boolean
}

export type MatchingLogin = Pick<DecryptedVaultItem<LoginItemData>, 'id' | 'data'>

// ---- popup <-> background ----

export type BackgroundRequest =
  | { type: 'GET_STATUS' }
  | { type: 'LOGIN'; email: string; password: string }
  | { type: 'UNLOCK'; password: string }
  | { type: 'SETUP_LOCAL_VAULT'; password: string }
  | { type: 'UNLOCK_LOCAL_VAULT'; password: string }
  | { type: 'RESET_LOCAL_VAULT' }
  | { type: 'LOCK' }
  | { type: 'SIGN_OUT' }
  | { type: 'LIST_LOGINS_FOR_ORIGIN'; origin: string }
  | { type: 'LIST_ALL_LOGINS' }
  | { type: 'SAVE_LOGIN'; data: LoginItemData }
  | { type: 'CREATE_LOGIN'; data: LoginItemData }
  | { type: 'UPDATE_LOGIN'; id: string; data: LoginItemData }
  | { type: 'DELETE_LOGIN'; id: string }

export type BackgroundResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

// ---- content script <-> background ----

/**
 * A login form's credentials, captured at submit time and held by the
 * background service worker (keyed by tab ID) across the page navigation a
 * real login submit almost always triggers — see the long comment in
 * content-script.ts for why this two-step handshake exists instead of
 * showing the save prompt synchronously on submit.
 */
export interface PendingSave {
  origin: string
  username: string
  password: string
}

export type ContentScriptMessage =
  | { type: 'LOGIN_FORM_SUBMITTED'; origin: string; username: string; password: string }
  | { type: 'FILL_CREDENTIALS'; username: string; password: string }
  | { type: 'CHECK_PENDING_SAVE' }
