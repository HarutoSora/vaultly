import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KDF_PARAMS,
  decryptJson,
  decryptText,
  decryptVaultKey,
  deriveKeyEncryptionKey,
  deriveLoginProof,
  encryptJson,
  encryptText,
  encryptVaultKey,
  generateVaultEncryptionKey,
  randomSaltBase64,
} from '../crypto'

// Small KDF params so these tests run fast — correctness doesn't depend on the cost parameters.
const FAST_PARAMS = { kdfMemoryKib: 8192, kdfIterations: 2, kdfParallelism: 1 }

describe('deriveKeyEncryptionKey', () => {
  it('is deterministic for the same password + salt + params', async () => {
    const params = { kdfSalt: randomSaltBase64(), ...FAST_PARAMS }
    const a = await deriveKeyEncryptionKey('correct horse battery staple', params)
    const b = await deriveKeyEncryptionKey('correct horse battery staple', params)
    expect(a).toEqual(b)
  })

  it('produces a different key for a different password', async () => {
    const params = { kdfSalt: randomSaltBase64(), ...FAST_PARAMS }
    const a = await deriveKeyEncryptionKey('password-one', params)
    const b = await deriveKeyEncryptionKey('password-two', params)
    expect(a).not.toEqual(b)
  })

  it('produces a different key for a different salt', async () => {
    const a = await deriveKeyEncryptionKey('same password', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const b = await deriveKeyEncryptionKey('same password', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    expect(a).not.toEqual(b)
  })

  it('returns a 32-byte (AES-256) key', async () => {
    const key = await deriveKeyEncryptionKey('pw', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    expect(key.length).toBe(32)
  })
})

describe('deriveLoginProof', () => {
  it('is deterministic for the same KEK + email', async () => {
    const kek = await deriveKeyEncryptionKey('pw', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const a = await deriveLoginProof(kek, 'user@example.com')
    const b = await deriveLoginProof(kek, 'user@example.com')
    expect(a).toBe(b)
  })

  it('differs for a different email (same KEK)', async () => {
    const kek = await deriveKeyEncryptionKey('pw', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const a = await deriveLoginProof(kek, 'alice@example.com')
    const b = await deriveLoginProof(kek, 'bob@example.com')
    expect(a).not.toBe(b)
  })

  it('never contains the KEK bytes as a substring (sanity check it is not just re-encoding the key)', async () => {
    const kek = await deriveKeyEncryptionKey('pw', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const proof = await deriveLoginProof(kek, 'user@example.com')
    const kekBase64 = btoa(String.fromCharCode(...kek))
    expect(proof).not.toContain(kekBase64)
  })
})

describe('vault key encrypt/decrypt round trip', () => {
  it('decrypts back to the original VEK with the correct KEK', async () => {
    const kek = await deriveKeyEncryptionKey('pw', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const vek = generateVaultEncryptionKey()

    const blob = await encryptVaultKey(vek, kek)
    const decrypted = await decryptVaultKey(blob, kek)

    expect(decrypted).toEqual(vek)
  })

  it('fails (throws) when decrypted with the wrong KEK — this is how a wrong master password is detected', async () => {
    const rightKek = await deriveKeyEncryptionKey('right-password', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const wrongKek = await deriveKeyEncryptionKey('wrong-password', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const vek = generateVaultEncryptionKey()

    const blob = await encryptVaultKey(vek, rightKek)

    await expect(decryptVaultKey(blob, wrongKek)).rejects.toThrow()
  })

  it('generates a fresh random nonce on every encryption (ciphertext differs even for the same VEK)', async () => {
    const kek = await deriveKeyEncryptionKey('pw', { kdfSalt: randomSaltBase64(), ...FAST_PARAMS })
    const vek = generateVaultEncryptionKey()

    const blob1 = await encryptVaultKey(vek, kek)
    const blob2 = await encryptVaultKey(vek, kek)

    expect(blob1.nonce).not.toBe(blob2.nonce)
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext)
  })
})

describe('vault item content encrypt/decrypt round trip', () => {
  const vek = generateVaultEncryptionKey()

  it('round-trips arbitrary JSON', async () => {
    const data = { name: 'GitHub', username: 'octocat', password: 'hunter2', website: '', notes: '' }
    const blob = await encryptJson(data, vek)
    const decrypted = await decryptJson<typeof data>(blob, vek)
    expect(decrypted).toEqual(data)
  })

  it('round-trips plain text (used for folder names)', async () => {
    const blob = await encryptText('Work', vek)
    expect(await decryptText(blob, vek)).toBe('Work')
  })

  it('fails when decrypted with a different VEK', async () => {
    const otherVek = generateVaultEncryptionKey()
    const blob = await encryptText('secret', vek)
    await expect(decryptText(blob, otherVek)).rejects.toThrow()
  })

  it('fails if the ciphertext is tampered with (authenticated encryption catches modification)', async () => {
    const blob = await encryptText('secret', vek)
    const tamperedBytes = Uint8Array.from(atob(blob.ciphertext), (c) => c.charCodeAt(0))
    tamperedBytes[0] ^= 0xff
    const tampered = { ciphertext: btoa(String.fromCharCode(...tamperedBytes)), nonce: blob.nonce }
    await expect(decryptText(tampered, vek)).rejects.toThrow()
  })
})

describe('randomSaltBase64', () => {
  it('produces unique values', () => {
    const salts = new Set(Array.from({ length: 100 }, () => randomSaltBase64()))
    expect(salts.size).toBe(100)
  })
})

describe('DEFAULT_KDF_PARAMS', () => {
  it('meets or exceeds the OWASP-minimum Argon2id baseline', () => {
    expect(DEFAULT_KDF_PARAMS.kdfMemoryKib).toBeGreaterThanOrEqual(19_456)
    expect(DEFAULT_KDF_PARAMS.kdfIterations).toBeGreaterThanOrEqual(2)
  })
})
