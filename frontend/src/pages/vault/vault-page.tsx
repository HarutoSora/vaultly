import * as React from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CreditCard, KeyRound, type LucideIcon, Plus, Search, Star, StickyNote, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ItemFormDialog } from '@/components/item-form-dialog'
import { ItemDetailPanel } from '@/components/item-detail-panel'
import { VaultItemRow } from '@/components/vault-item-row'
import { useDecryptedFolders, useDecryptedVaultItems } from '@/hooks/use-vault'
import { cn } from '@/lib/utils'
import { type DecryptedVaultItem, type LoginItemData, VaultItemType } from '@vaultly/shared'

export type VaultView = 'all' | 'favorites' | 'logins' | 'notes' | 'cards' | 'trash' | 'folder'

const VIEW_META: Record<VaultView, { title: string; icon: LucideIcon }> = {
  all: { title: 'All Items', icon: KeyRound },
  favorites: { title: 'Favorites', icon: Star },
  logins: { title: 'Logins', icon: KeyRound },
  notes: { title: 'Secure Notes', icon: StickyNote },
  cards: { title: 'Credit Cards', icon: CreditCard },
  trash: { title: 'Trash', icon: Trash2 },
  folder: { title: 'Folder', icon: KeyRound },
}

function matchesView(item: DecryptedVaultItem, view: VaultView, folderId?: string): boolean {
  switch (view) {
    case 'favorites':
      return item.favorite
    case 'logins':
      return item.type === VaultItemType.Login
    case 'notes':
      return item.type === VaultItemType.SecureNote
    case 'cards':
      return item.type === VaultItemType.CreditCard
    case 'folder':
      return item.folderId === folderId
    default:
      return true
  }
}

/**
 * Higher is more relevant; 0 means "doesn't match, exclude it." Ranked
 * rather than a plain boolean so that e.g. searching "gmail" puts an item
 * actually named "Gmail" first, instead of burying it among every other
 * login whose username happens to be a @gmail.com address too.
 */
function searchScore(item: DecryptedVaultItem, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const name = item.data.name.toLowerCase()

  if (name.startsWith(q)) return 3
  if (name.includes(q)) return 2

  if (item.type === VaultItemType.Login) {
    const login = item.data as LoginItemData
    if (login.username.toLowerCase().includes(q) || login.website.toLowerCase().includes(q)) {
      return 1
    }
  }

  return 0
}

export function VaultPage({ view }: { view: VaultView }) {
  const { folderId } = useParams()
  const { folders } = useDecryptedFolders()
  const { items, isLoading } = useDecryptedVaultItems(view === 'trash')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    const scored = items
      .filter((i) => matchesView(i, view, folderId))
      .map((item) => ({ item, score: searchScore(item, search) }))
      .filter(({ score }) => score > 0)

    if (search) {
      scored.sort((a, b) => b.score - a.score) // stable sort — equal scores keep their existing (updatedAt-desc) order
    }

    return scored.map(({ item }) => item)
  }, [items, view, folderId, search])

  const selected = filtered.find((i) => i.id === selectedId) ?? null
  const meta = view === 'folder'
    ? { title: folders.find((f) => f.id === folderId)?.name ?? 'Folder', icon: VIEW_META.folder.icon }
    : VIEW_META[view]

  React.useEffect(() => {
    setSelectedId(null)
  }, [view, folderId])

  return (
    <div className="flex h-full">
      <div
        className={cn(
          'flex w-full flex-col border-r border-border md:w-80 md:shrink-0',
          selected && 'hidden md:flex',
        )}
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 font-semibold text-text">
              <meta.icon className="size-4 text-text-muted" />
              {meta.title}
            </h1>
            {view !== 'trash' && (
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" /> New
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or link"
              className="pl-8"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex flex-col gap-1.5 p-1">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon={search ? Search : meta.icon}
              title={search ? 'No matches' : emptyTitle(view)}
              description={search ? `Nothing matches "${search}".` : emptyDescription(view)}
              action={
                !search && view !== 'trash' ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                    <Plus className="size-3.5" /> Add an item
                  </Button>
                ) : undefined
              }
            />
          )}

          <AnimatePresence initial={false}>
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.015, 0.15) }}
              >
                <VaultItemRow item={item} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className={cn('min-w-0 flex-1', !selected && 'hidden md:block')}>
        {selected ? (
          <ItemDetailPanel item={selected} onBack={() => setSelectedId(null)} onDeleted={() => setSelectedId(null)} />
        ) : (
          <EmptyState icon={meta.icon} title="Select an item" description="Choose an item from the list to view its details." />
        )}
      </div>

      <ItemFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultFolderId={view === 'folder' ? (folderId ?? null) : null}
        defaultType={view === 'notes' ? VaultItemType.SecureNote : view === 'cards' ? VaultItemType.CreditCard : VaultItemType.Login}
      />
    </div>
  )
}

function emptyTitle(view: VaultView): string {
  if (view === 'trash') return 'Trash is empty'
  if (view === 'favorites') return 'No favorites yet'
  return 'No items yet'
}

function emptyDescription(view: VaultView): string {
  if (view === 'trash') return 'Deleted items will show up here.'
  if (view === 'favorites') return 'Star an item to pin it here.'
  return 'Add your first item to get started.'
}
