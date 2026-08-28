import { api } from './api-client'
import {
  DEFAULT_KDF_PARAMS,
  decryptVaultKey,
  deriveKeyEncryptionKey,
  deriveLoginProof,
  encryptVaultKey,
  generateVaultEncryptionKey,
  randomSaltBase64,
} from './crypto'

interface PreloginResponse {
  kdfSalt: string
  kdfMemoryKib: number
  kdfIterations: number
  kdfParallelism: number
}

interface LoginResponse {
  userId: string
  email: string
  protectedVaultKeyCiphertext: string
  protectedVaultKeyNonce: string
  encryptionVersion: number
}

interface RegisterResponse {
  userId: string
  email: string
}

interface MeResponse {
  userId: string
  email: string
}

interface VaultKeyResponse {
  kdfSalt: string
  kdfMemoryKib: number
  kdfIterations: number
  kdfParallelism: number
  protectedVaultKeyCiphertext: string
  protectedVaultKeyNonce: string
  encryptionVersion: number
}

/** Everything a signed-in session needs kept in memory. Never persisted — a reload always re-derives it from a fresh login. */
export interface UnlockedSession {
  userId: string
  email: string
  vaultEncryptionKey: Uint8Array
}

export async function register(email: string, masterPassword: string): Promise<RegisterResponse> {
  const kdfSalt = randomSaltBase64()
  const kdfParams = { kdfSalt, ...DEFAULT_KDF_PARAMS }

  const kek = await deriveKeyEncryptionKey(masterPassword, kdfParams)
  const loginProof = await deriveLoginProof(kek, email)

  const vek = generateVaultEncryptionKey()
  const protectedVaultKey = await encryptVaultKey(vek, kek)

  return api.post<RegisterResponse>('/auth/register', {
    email,
    kdfSalt,
    kdfMemoryKib: kdfParams.kdfMemoryKib,
    kdfIterations: kdfParams.kdfIterations,
    kdfParallelism: kdfParams.kdfParallelism,
    loginProof,
    protectedVaultKeyCiphertext: protectedVaultKey.ciphertext,
    protectedVaultKeyNonce: protectedVaultKey.nonce,
  })
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post<void>('/auth/verify-email', { token })
}

export async function login(
  email: string,
  masterPassword: string,
  deviceName?: string,
): Promise<UnlockedSession> {
  const prelogin = await api.post<PreloginResponse>('/auth/prelogin', { email })
  const kek = await deriveKeyEncryptionKey(masterPassword, prelogin)
  const loginProof = await deriveLoginProof(kek, email)

  const result = await api.post<LoginResponse>('/auth/login', { email, loginProof, deviceName })

  const vek = await decryptVaultKey(
    { ciphertext: result.protectedVaultKeyCiphertext, nonce: result.protectedVaultKeyNonce },
    kek,
  )

  return { userId: result.userId, email: result.email, vaultEncryptionKey: vek }
}

export async function logout(): Promise<void> {
  await api.post<void>('/auth/logout')
}

export async function logoutAll(): Promise<void> {
  await api.post<void>('/auth/logout-all')
}

export async function fetchCurrentUser(): Promise<MeResponse | null> {
  try {
    return await api.get<MeResponse>('/auth/me')
  } catch {
    return null
  }
}

/**
 * Re-derives the KEK from a freshly-entered master password and decrypts the
 * VEK, without creating a new session — used to unlock after a reload or an
 * idle auto-lock while the session cookie is still valid.
 */
export async function unlockVault(masterPassword: string): Promise<Uint8Array> {
  const vaultKey = await api.get<VaultKeyResponse>('/auth/vault-key')
  const kek = await deriveKeyEncryptionKey(masterPassword, vaultKey)
  return decryptVaultKey(
    { ciphertext: vaultKey.protectedVaultKeyCiphertext, nonce: vaultKey.protectedVaultKeyNonce },
    kek,
  )
}
