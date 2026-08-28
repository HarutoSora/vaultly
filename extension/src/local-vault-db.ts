/**
 * Thin promisified wrapper around IndexedDB — the actual "lightweight
 * database" behind local-only mode. Runs entirely inside the extension's
 * own storage partition (isolated from every website, and from the other
 * extension's data on the same browser) — nothing here ever leaves the
 * device. Only ciphertext is ever stored; see local-vault.ts for the
 * encrypt/decrypt boundary.
 */

const DB_NAME = 'vaultly-local'
const DB_VERSION = 1
const STORE = 'items'

export interface LocalItemRow {
  id: string
  type: number
  favorite: boolean
  folderId: string | null
  dataCiphertext: string
  dataNonce: string
  encryptionVersion: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runReadonly<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const request = fn(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
      }),
  )
}

function runReadwrite(fn: (store: IDBObjectStore) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        fn(tx.objectStore(STORE))
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export function listItems(): Promise<LocalItemRow[]> {
  return runReadonly((store) => store.getAll())
}

export function getItem(id: string): Promise<LocalItemRow | undefined> {
  return runReadonly((store) => store.get(id))
}

export function putItem(item: LocalItemRow): Promise<void> {
  return runReadwrite((store) => {
    store.put(item)
  })
}

export function deleteItem(id: string): Promise<void> {
  return runReadwrite((store) => {
    store.delete(id)
  })
}

export function clearAll(): Promise<void> {
  return runReadwrite((store) => {
    store.clear()
  })
}
