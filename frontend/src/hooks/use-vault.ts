import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decryptJson, decryptText, encryptJson, encryptText } from '@vaultly/shared'
import { useSession } from '@/lib/session'
import {
  type DecryptedFolder,
  type DecryptedVaultItem,
  type VaultItemData,
  type VaultItemType,
  toBlob,
} from '@vaultly/shared'
import { type FolderPayload, foldersApi, vaultItemsApi } from '@vaultly/shared'

const ITEMS_KEY = (trashed: boolean) => ['vault-items', trashed] as const
const FOLDERS_KEY = ['vault-folders'] as const

// ---- items -----------------------------------------------------------

export function useDecryptedVaultItems(trashed = false) {
  const { vaultEncryptionKey } = useSession()
  const query = useQuery({
    queryKey: ITEMS_KEY(trashed),
    queryFn: () => vaultItemsApi.list(trashed),
    enabled: !!vaultEncryptionKey,
  })
  const [items, setItems] = React.useState<DecryptedVaultItem[]>([])
  const [decrypting, setDecrypting] = React.useState(false)

  React.useEffect(() => {
    const encrypted = query.data
    if (!encrypted || !vaultEncryptionKey) {
      setItems([])
      return
    }
    let cancelled = false
    setDecrypting(true)
    Promise.all(
      encrypted.map(async (item) => ({
        id: item.id,
        type: item.type,
        favorite: item.favorite,
        folderId: item.folderId,
        data: await decryptJson<VaultItemData>(toBlob(item.dataCiphertext, item.dataNonce), vaultEncryptionKey),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        deletedAt: item.deletedAt,
      })),
    )
      .then((decrypted) => {
        if (!cancelled) setItems(decrypted)
      })
      .finally(() => {
        if (!cancelled) setDecrypting(false)
      })
    return () => {
      cancelled = true
    }
  }, [query.data, vaultEncryptionKey])

  return {
    items,
    isLoading: query.isLoading || decrypting,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useCreateVaultItem() {
  const { vaultEncryptionKey } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      type: VaultItemType
      data: VaultItemData
      folderId: string | null
      favorite: boolean
    }) => {
      if (!vaultEncryptionKey) throw new Error('Vault is locked.')
      const blob = await encryptJson(input.data, vaultEncryptionKey)
      return vaultItemsApi.create({
        type: input.type,
        favorite: input.favorite,
        folderId: input.folderId,
        dataCiphertext: blob.ciphertext,
        dataNonce: blob.nonce,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS_KEY(false) }),
  })
}

export function useUpdateVaultItem() {
  const { vaultEncryptionKey } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      data: VaultItemData
      folderId: string | null
      favorite: boolean
    }) => {
      if (!vaultEncryptionKey) throw new Error('Vault is locked.')
      const blob = await encryptJson(input.data, vaultEncryptionKey)
      return vaultItemsApi.update(input.id, {
        favorite: input.favorite,
        folderId: input.folderId,
        dataCiphertext: blob.ciphertext,
        dataNonce: blob.nonce,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-items'] }),
  })
}

export function useTrashVaultItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vaultItemsApi.trash(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-items'] }),
  })
}

export function useRestoreVaultItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vaultItemsApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-items'] }),
  })
}

export function usePurgeVaultItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vaultItemsApi.purge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-items'] }),
  })
}

// ---- folders -----------------------------------------------------------

export function useDecryptedFolders() {
  const { vaultEncryptionKey } = useSession()
  const query = useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: () => foldersApi.list(),
    enabled: !!vaultEncryptionKey,
  })
  const [folders, setFolders] = React.useState<DecryptedFolder[]>([])

  React.useEffect(() => {
    const encrypted = query.data
    if (!encrypted || !vaultEncryptionKey) {
      setFolders([])
      return
    }
    let cancelled = false
    Promise.all(
      encrypted.map(async (f) => ({
        id: f.id,
        name: await decryptText(toBlob(f.nameCiphertext, f.nameNonce), vaultEncryptionKey),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    ).then((decrypted) => {
      if (!cancelled) setFolders(decrypted)
    })
    return () => {
      cancelled = true
    }
  }, [query.data, vaultEncryptionKey])

  return { folders, isLoading: query.isLoading }
}

async function encryptFolderName(name: string, vek: Uint8Array): Promise<FolderPayload> {
  const blob = await encryptText(name, vek)
  return { nameCiphertext: blob.ciphertext, nameNonce: blob.nonce }
}

export function useCreateFolder() {
  const { vaultEncryptionKey } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      if (!vaultEncryptionKey) throw new Error('Vault is locked.')
      return foldersApi.create(await encryptFolderName(name, vaultEncryptionKey))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  })
}

export function useRenameFolder() {
  const { vaultEncryptionKey } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!vaultEncryptionKey) throw new Error('Vault is locked.')
      return foldersApi.rename(id, await encryptFolderName(name, vaultEncryptionKey))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => foldersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOLDERS_KEY })
      qc.invalidateQueries({ queryKey: ['vault-items'] })
    },
  })
}
