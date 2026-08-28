/**
 * The entire zero-knowledge boundary lives in this file. Nothing in here
 * ever sends a plaintext master password, a derived key, or decrypted vault
 * content anywhere — everything that leaves this module either stays in
 * memory or is already ciphertext/a one-way derivation. See
 * docs/cryptography.md for the full chain this implements:
 *
 *   Master Password --Argon2id--> Key Encryption Key (KEK)
 *     KEK --HMAC-SHA256--> Login Proof (sent to the server)
 *     KEK --AES-256-GCM--> encrypts/decrypts the Vault Encryption Key (VEK)
 *   VEK --AES-256-GCM--> encrypts/decrypts every vault item
 *
 * Established primitives only: Argon2id (hash-wasm, a WASM port of the
 * reference implementation) and AES-GCM/HMAC via the browser's native
 * WebCrypto — nothing here is home-grown.
 */
import { argon2id } from 'hash-wasm'

export const ENCRYPTION_VERSION = 1

export interface KdfParams {
  kdfSalt: string // base64
  kdfMemoryKib: number
  kdfIterations: number
  kdfParallelism: number
}

export interface EncryptedBlob {
  ciphertext: string // base64
  nonce: string // base64
}

const AES_KEY_LENGTH_BYTES = 32 // AES-256
const GCM_NONCE_LENGTH_BYTES = 12 // 96-bit, the size AES-GCM is defined/optimized for

// ---- base64 <-> bytes -------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ---- random generation --------------------------------------------------

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function randomSaltBase64(length = 16): string {
  return bytesToBase64(randomBytes(length))
}

// ---- KDF: master password -> Key Encryption Key ------------------------

/** OWASP-minimum-or-better defaults for a brand-new account. */
export const DEFAULT_KDF_PARAMS = {
  kdfMemoryKib: 65536, // 64 MiB
  kdfIterations: 3,
  kdfParallelism: 1, // most browser tabs realistically get one core's worth of budget
} as const

export async function deriveKeyEncryptionKey(
  masterPassword: string,
  params: KdfParams,
): Promise<Uint8Array> {
  const salt = base64ToBytes(params.kdfSalt)
  const hash = await argon2id({
    password: masterPassword,
    salt,
    parallelism: params.kdfParallelism,
    iterations: params.kdfIterations,
    memorySize: params.kdfMemoryKib,
    hashLength: AES_KEY_LENGTH_BYTES,
    outputType: 'binary',
  })
  return hash as Uint8Array
}

/**
 * Derives the value sent to the server to prove knowledge of the master
 * password, WITHOUT revealing the Key Encryption Key itself — HMAC is a
 * one-way PRF, so the server (or anyone who steals its database) learns
 * nothing about the KEK, and therefore nothing about the vault key, from
 * this value.
 */
export async function deriveLoginProof(kek: Uint8Array, email: string): Promise<string> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(kek),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const message = new TextEncoder().encode(`vaultly-login-proof:${email.trim().toLowerCase()}`)
  const signature = await crypto.subtle.sign('HMAC', hmacKey, message)
  return bytesToBase64(new Uint8Array(signature))
}

// ---- AES-256-GCM ---------------------------------------------------------

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toArrayBuffer(rawKey), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function aesEncrypt(plaintext: Uint8Array, rawKey: Uint8Array): Promise<EncryptedBlob> {
  const key = await importAesKey(rawKey)
  const nonce = randomBytes(GCM_NONCE_LENGTH_BYTES)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(plaintext),
  )
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), nonce: bytesToBase64(nonce) }
}

async function aesDecrypt(blob: EncryptedBlob, rawKey: Uint8Array): Promise<Uint8Array> {
  const key = await importAesKey(rawKey)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(blob.nonce)) },
    key,
    toArrayBuffer(base64ToBytes(blob.ciphertext)),
  )
  return new Uint8Array(plaintext)
}

// ---- Vault Encryption Key (VEK) ------------------------------------------

export function generateVaultEncryptionKey(): Uint8Array {
  return randomBytes(AES_KEY_LENGTH_BYTES)
}

export async function encryptVaultKey(vek: Uint8Array, kek: Uint8Array): Promise<EncryptedBlob> {
  return aesEncrypt(vek, kek)
}

export async function decryptVaultKey(blob: EncryptedBlob, kek: Uint8Array): Promise<Uint8Array> {
  return aesDecrypt(blob, kek)
}

// ---- Vault item / folder content ------------------------------------------

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export async function encryptJson<T>(data: T, vek: Uint8Array): Promise<EncryptedBlob> {
  const plaintext = textEncoder.encode(JSON.stringify(data))
  return aesEncrypt(plaintext, vek)
}

export async function decryptJson<T>(blob: EncryptedBlob, vek: Uint8Array): Promise<T> {
  const plaintext = await aesDecrypt(blob, vek)
  return JSON.parse(textDecoder.decode(plaintext)) as T
}

export async function encryptText(text: string, vek: Uint8Array): Promise<EncryptedBlob> {
  return aesEncrypt(textEncoder.encode(text), vek)
}

export async function decryptText(blob: EncryptedBlob, vek: Uint8Array): Promise<string> {
  const plaintext = await aesDecrypt(blob, vek)
  return textDecoder.decode(plaintext)
}
