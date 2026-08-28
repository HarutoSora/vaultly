import * as React from 'react'
import { CreditCard, Globe, StickyNote } from 'lucide-react'
import { VaultItemType, faviconUrl } from '@vaultly/shared'
import { cn } from '@/lib/utils'

const ICONS = {
  [VaultItemType.Login]: Globe,
  [VaultItemType.SecureNote]: StickyNote,
  [VaultItemType.CreditCard]: CreditCard,
}

export function VaultItemIcon({
  type,
  website,
  className,
}: {
  type: VaultItemType
  /** Only used for Login items — shows the site's own favicon instead of the generic type icon when it loads. */
  website?: string
  className?: string
}) {
  const Icon = ICONS[type]
  const [failed, setFailed] = React.useState(false)
  const src = type === VaultItemType.Login ? faviconUrl(website ?? '') : null

  // Reset if the item's website changes (e.g. editing a different item while this instance is reused).
  React.useEffect(() => setFailed(false), [src])

  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-text-muted',
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="size-5 object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon className="size-4" />
      )}
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
