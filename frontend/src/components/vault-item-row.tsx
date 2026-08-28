import { Star } from 'lucide-react'
import { VaultItemIcon } from '@/components/vault-item-icon'
import { cn } from '@/lib/utils'
import type { DecryptedVaultItem, LoginItemData } from '@vaultly/shared'
import { VaultItemType } from '@vaultly/shared'

function subtitle(item: DecryptedVaultItem): string {
  if (item.type === VaultItemType.Login) return (item.data as LoginItemData).username || 'No username'
  if (item.type === VaultItemType.CreditCard) return 'Credit card'
  return 'Secure note'
}

export function VaultItemRow({
  item,
  selected,
  onClick,
}: {
  item: DecryptedVaultItem
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
        selected ? 'bg-brand-subtle' : 'hover:bg-surface',
      )}
    >
      <VaultItemIcon
        type={item.type}
        website={item.type === VaultItemType.Login ? (item.data as LoginItemData).website : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{item.data.name || 'Untitled'}</p>
        <p className="truncate text-xs text-text-faint">{subtitle(item)}</p>
      </div>
      {item.favorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
    </button>
  )
}
