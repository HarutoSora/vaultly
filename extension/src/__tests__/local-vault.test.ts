import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as localVault from '../local-vault'
import * as db from '../local-vault-db'

const LOGIN_A = { name: 'GitHub', username: 'octocat', password: 'hunter2', website: 'https://github.com', notes: '' }
const LOGIN_B = { name: 'Gmail', username: 'me@gmail.com', password: 'p@ss', website: 'https://mail.google.com', notes: '' }

beforeEach(async () => {
  // Fresh state for every test: no vault metadata, no stored items.
  await localVault.reset()
})

afterEach(async () => {
  await localVault.reset()
})

describe('isSetUp / setup', () => {
  it('reports not set up before any vault exists', async () => {
    expect(await localVault.isSetUp()).toBe(false)
  })

  it('reports set up after setup() succeeds', async () => {
    await localVault.setup('a-fine-master-password')
    expect(await localVault.isSetUp()).toBe(true)
  })

  it('returns a usable 32-byte VEK from setup()', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    expect(vek.length).toBe(32)
  })

  it('refuses to set up a second vault on top of an existing one', async () => {
    await localVault.setup('first-password')
    await expect(localVault.setup('second-password')).rejects.toThrow(/already exists/i)
  })

  it('rejects a too-short master password before touching storage', async () => {
    await expect(localVault.setup('short')).rejects.toThrow()
    expect(await localVault.isSetUp()).toBe(false)
  })
})

describe('unlock', () => {
  it('returns the same VEK setup() produced, given the correct password', async () => {
    const vekFromSetup = await localVault.setup('correct horse battery staple')
    const vekFromUnlock = await localVault.unlock('correct horse battery staple')
    expect(vekFromUnlock).toEqual(vekFromSetup)
  })

  it('throws on a wrong password rather than returning a bad key silently', async () => {
    await localVault.setup('the-real-password')
    await expect(localVault.unlock('a-wrong-password')).rejects.toThrow()
  })

  it('throws a clear error when no vault has been set up yet', async () => {
    await expect(localVault.unlock('anything')).rejects.toThrow(/no local vault/i)
  })
})

describe('reset', () => {
  it('wipes both the vault metadata and every stored item', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    await localVault.createItem(vek, LOGIN_A)

    await localVault.reset()

    expect(await localVault.isSetUp()).toBe(false)
    expect(await db.listItems()).toEqual([])
  })
})

describe('item CRUD', () => {
  it('creates and lists an item, decrypted correctly', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    await localVault.createItem(vek, LOGIN_A)

    const items = await localVault.listItems(vek)
    expect(items).toHaveLength(1)
    expect(items[0].data).toEqual(LOGIN_A)
  })

  it('lists multiple items, most recently updated first', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    await localVault.createItem(vek, LOGIN_A)
    await new Promise((r) => setTimeout(r, 2)) // ensure a distinct updatedAt tick
    await localVault.createItem(vek, LOGIN_B)

    const items = await localVault.listItems(vek)
    expect(items.map((i) => i.data.name)).toEqual(['Gmail', 'GitHub'])
  })

  it('updates an item in place', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    const id = await localVault.createItem(vek, LOGIN_A)

    await localVault.updateItem(vek, id, { ...LOGIN_A, password: 'new-password' })

    const items = await localVault.listItems(vek)
    expect(items).toHaveLength(1)
    expect(items[0].data.password).toBe('new-password')
  })

  it('throws when updating an item that does not exist', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    await expect(localVault.updateItem(vek, 'not-a-real-id', LOGIN_A)).rejects.toThrow(/not found/i)
  })

  it('permanently removes an item on purge', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    const id = await localVault.createItem(vek, LOGIN_A)

    await localVault.purgeItem(id)

    expect(await localVault.listItems(vek)).toEqual([])
  })

  it('stores items encrypted at rest — the raw DB row never contains the plaintext password', async () => {
    const vek = await localVault.setup('a-fine-master-password')
    await localVault.createItem(vek, LOGIN_A)

    const rows = await db.listItems()
    expect(rows).toHaveLength(1)
    expect(rows[0].dataCiphertext).not.toContain(LOGIN_A.password)
  })

  it('fails to decrypt items under the wrong VEK (cross-vault isolation)', async () => {
    const vekA = await localVault.setup('password-for-vault-a')
    await localVault.createItem(vekA, LOGIN_A)
    await localVault.reset()
    const vekB = await localVault.setup('password-for-vault-b')

    // vekA is now stale/foreign relative to what's stored under vekB's vault.
    await localVault.createItem(vekB, LOGIN_B)
    await expect(localVault.listItems(vekA)).rejects.toThrow()
  })
})
