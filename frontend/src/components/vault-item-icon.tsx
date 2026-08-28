import { CreditCard, Globe, StickyNote } from 'lucide-react'
import { VaultItemType } from '@vaultly/shared'
import { cn } from '@/lib/utils'

const ICONS = {
  [VaultItemType.Login]: Globe,
  [VaultItemType.SecureNote]: StickyNote,
  [VaultItemType.CreditCard]: CreditCard,
}

export function VaultItemIcon({ type, className }: { type: VaultItemType; className?: string }) {
  const Icon = ICONS[type]
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-text-muted',
        className,
      )}
    >
      <Icon className="size-4" />
    </div>
  )
}

export function itemTypeLabel(type: VaultItemType): string {
  switch (type) {
    case VaultItemType.Login:
      return 'Login'
    case VaultItemType.SecureNote:
      return 'Secure Note'
    case VaultItemType.CreditCard:
      return 'Credit Card'
  }
}
