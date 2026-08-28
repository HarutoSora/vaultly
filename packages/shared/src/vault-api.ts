import { api } from './api-client'
import type { FolderDto, VaultItemDto, VaultItemType } from './types'

export interface CreateVaultItemPayload {
  type: VaultItemType
  favorite: boolean
  folderId: string | null
  dataCiphertext: string
  dataNonce: string
}

export type UpdateVaultItemPayload = Omit<CreateVaultItemPayload, 'type'>

export const vaultItemsApi = {
  list: (trashed = false) => api.get<VaultItemDto[]>(`/vault/items?trashed=${trashed}`),
  get: (id: string) => api.get<VaultItemDto>(`/vault/items/${id}`),
  create: (payload: CreateVaultItemPayload) => api.post<VaultItemDto>('/vault/items', payload),
  update: (id: string, payload: UpdateVaultItemPayload) =>
    api.put<VaultItemDto>(`/vault/items/${id}`, payload),
  trash: (id: string) => api.post<void>(`/vault/items/${id}/trash`),
  restore: (id: string) => api.post<void>(`/vault/items/${id}/restore`),
  purge: (id: string) => api.del<void>(`/vault/items/${id}`),
}

export interface FolderPayload {
  nameCiphertext: string
  nameNonce: string
}

export const foldersApi = {
  list: () => api.get<FolderDto[]>('/vault/folders'),
  create: (payload: FolderPayload) => api.post<FolderDto>('/vault/folders', payload),
  rename: (id: string, payload: FolderPayload) => api.put<FolderDto>(`/vault/folders/${id}`, payload),
  remove: (id: string) => api.del<void>(`/vault/folders/${id}`),
}
