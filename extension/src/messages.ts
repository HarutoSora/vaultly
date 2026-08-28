import type { DecryptedVaultItem, LoginItemData } from '@vaultly/shared'

export type ExtensionStatus = 'loading' | 'signed-out' | 'locked' | 'unlocked'

export interface StatusResponse {
  status: ExtensionStatus
  email: string | null
}

export type MatchingLogin = Pick<DecryptedVaultItem<LoginItemData>, 'id' | 'data'>

// ---- popup <-> background ----

export type BackgroundRequest =
  | { type: 'GET_STATUS' }
  | { type: 'LOGIN'; email: string; password: string }
  | { type: 'UNLOCK'; password: string }
  | { type: 'LOCK' }
  | { type: 'SIGN_OUT' }
  | { type: 'LIST_LOGINS_FOR_ORIGIN'; origin: string }
  | { type: 'SAVE_LOGIN'; data: LoginItemData }

export type BackgroundResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

// ---- content script <-> background/popup ----

export type ContentScriptMessage =
  | { type: 'LOGIN_FORM_SUBMITTED'; origin: string; username: string; password: string }
  | { type: 'FILL_CREDENTIALS'; username: string; password: string }
  | { type: 'REQUEST_SAVE_PROMPT'; origin: string; username: string; password: string }
