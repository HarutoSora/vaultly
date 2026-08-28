import type { EncryptedBlob } from './crypto'

export const VaultItemType = {
  Login: 0,
  SecureNote: 1,
  CreditCard: 2,
} as const
export type VaultItemType = (typeof VaultItemType)[keyof typeof VaultItemType]

// ---- Wire shapes (exactly what the API sends/accepts — ciphertext only) ----

export interface VaultItemDto {
  id: string
  type: VaultItemType
  favorite: boolean
  folderId: string | null
  dataCiphertext: string
  dataNonce: string
  encryptionVersion: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface FolderDto {
  id: string
  nameCiphertext: string
  nameNonce: string
  encryptionVersion: number
  createdAt: string
  updatedAt: string
}

// ---- Plaintext shapes (only ever exist client-side, in memory) ----

export interface LoginItemData {
  name: string
  username: string
  password: string
  website: string
  notes: string
}

export interface SecureNoteItemData {
  name: string
  content: string
  notes: string
}

export interface CreditCardItemData {
  name: string
  cardholder: string
  number: string
  expiration: string
  cvv: string
  notes: string
}

export type VaultItemData = LoginItemData | SecureNoteItemData | CreditCardItemData

export interface DecryptedVaultItem<T extends VaultItemData = VaultItemData> {
  id: string
  type: VaultItemType
  favorite: boolean
  folderId: string | null
  data: T
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface DecryptedFolder {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export function toBlob(ciphertext: string, nonce: string): EncryptedBlob {
  return { ciphertext, nonce }
}

export function emptyItemData(type: VaultItemType): VaultItemData {
  switch (type) {
    case VaultItemType.Login:
      return { name: '', username: '', password: '', website: '', notes: '' }
    case VaultItemType.SecureNote:
      return { name: '', content: '', notes: '' }
    case VaultItemType.CreditCard:
      return { name: '', cardholder: '', number: '', expiration: '', cvv: '', notes: '' }
  }
}
