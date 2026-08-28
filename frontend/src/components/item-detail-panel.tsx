import * as React from 'react'
import { ArrowLeft, ExternalLink, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ItemFormDialog } from '@/components/item-form-dialog'
import { SecretValue } from '@/components/secret-value'
import { VaultItemIcon, itemTypeLabel } from '@/components/vault-item-icon'
import {
  usePurgeVaultItem,
  useRestoreVaultItem,
  useTrashVaultItem,
  useUpdateVaultItem,
} from '@/hooks/use-vault'
import type { CreditCardItemData, DecryptedVaultItem, LoginItemData, SecureNoteItemData } from '@vaultly/shared'
import { VaultItemType } from '@vaultly/shared'

export function ItemDetailPanel({
  item,
  onBack,
  onDeleted,
}: {
  item: DecryptedVaultItem
  onBack?: () => void
  onDeleted?: () => void
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [confirmTrashOpen, setConfirmTrashOpen] = React.useState(false)
  const [confirmPurgeOpen, setConfirmPurgeOpen] = React.useState(false)
  const update = useUpdateVaultItem()
  const trash = useTrashVaultItem()
  const restore = useRestoreVaultItem()
  const purge = usePurgeVaultItem()

  const isTrashed = !!item.deletedAt

  const toggleFavorite = async () => {
    try {
      await update.mutateAsync({
        id: item.id,
        data: item.data,
        folderId: item.folderId,
        favorite: !item.favorite,
      })
    } catch {
      toast.error('Could not update favorite.')
    }
  }

  const handleTrash = async () => {
    try {
      await trash.mutateAsync(item.id)
      toast.success('Moved to trash')
      onDeleted?.()
    } catch {
      toast.error('Could not delete the item.')
    } finally {
      setConfirmTrashOpen(false)
    }
  }

  const handleRestore = async () => {
    try {
      await restore.mutateAsync(item.id)
      toast.success('Item restored')
    } catch {
      toast.error('Could not restore the item.')
    }
  }

  const handlePurge = async () => {
    try {
      await purge.mutateAsync(item.id)
      toast.success('Item permanently deleted')
      onDeleted?.()
    } catch {
      toast.error('Could not delete the item.')
    } finally {
      setConfirmPurgeOpen(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{item.data.name || 'Untitled'}</p>
          <p className="text-xs text-text-faint">{itemTypeLabel(item.type)}</p>
        </div>

        {!isTrashed && (
          <>
            <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label="Toggle favorite">
              <Star className={item.favorite ? 'size-4 fill-warning text-warning' : 'size-4'} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label="Edit item">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmTrashOpen(true)}
              aria-label="Delete item"
            >
              <Trash2 className="size-4 text-danger" />
            </Button>
          </>
        )}
        {isTrashed && (
          <>
            <Button variant="outline" size="sm" onClick={handleRestore} className="gap-1.5">
              <RotateCcw className="size-3.5" /> Restore
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPurgeOpen(true)}
              className="gap-1.5 text-danger hover:text-danger"
            >
              <Trash2 className="size-3.5" /> Delete forever
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          {isTrashed && (
            <Badge variant="danger" className="w-fit">
              In trash
            </Badge>
          )}

          <div className="flex items-center gap-3">
            <VaultItemIcon type={item.type} className="size-11" />
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{item.data.name || 'Untitled'}</p>
              <p className="text-xs text-text-faint">
                Updated {new Date(item.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <Separator />

          {item.type === VaultItemType.Login && <LoginDetail data={item.data as LoginItemData} />}
          {item.type === VaultItemType.SecureNote && (
            <SecureNoteDetail data={item.data as SecureNoteItemData} />
          )}
          {item.type === VaultItemType.CreditCard && (
            <CreditCardDetail data={item.data as CreditCardItemData} />
          )}
        </div>
      </div>

      <ItemFormDialog open={editOpen} onOpenChange={setEditOpen} editingItem={item} />

      <AlertDialog open={confirmTrashOpen} onOpenChange={setConfirmTrashOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{item.data.name || 'Untitled'}&quot; will move to Trash. You can restore it later, or
              delete it permanently from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTrash} className="bg-danger hover:opacity-90">
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPurgeOpen} onOpenChange={setConfirmPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. &quot;{item.data.name || 'Untitled'}&quot; will be gone for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurge} className="bg-danger hover:opacity-90">
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-faint">{label}</span>
      {children}
    </div>
  )
}

function PlainValue({ value }: { value: string }) {
  return (
    <p className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text">
      {value || <span className="text-text-faint">Empty</span>}
    </p>
  )
}

function LoginDetail({ data }: { data: LoginItemData }) {
  return (
    <>
      <DetailField label="Username">
        <SecretValue value={data.username} masked={false} mono={false} />
      </DetailField>
      <DetailField label="Password">
        <SecretValue value={data.password} />
      </DetailField>
      <DetailField label="Website">
        {data.website ? (
          <a
            href={data.website}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-brand hover:underline"
          >
            <span className="min-w-0 flex-1 truncate">{data.website}</span>
            <ExternalLink className="size-3.5 shrink-0" />
          </a>
        ) : (
          <PlainValue value="" />
        )}
      </DetailField>
      {data.notes && (
        <DetailField label="Notes">
          <p className="whitespace-pre-wrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text">
            {data.notes}
          </p>
        </DetailField>
      )}
    </>
  )
}

function SecureNoteDetail({ data }: { data: SecureNoteItemData }) {
  return (
    <>
      <DetailField label="Content">
        <p className="whitespace-pre-wrap rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-sm text-text">
          {data.content || <span className="font-sans text-text-faint">Empty</span>}
        </p>
      </DetailField>
      {data.notes && (
        <DetailField label="Notes">
          <p className="whitespace-pre-wrap text-sm text-text-muted">{data.notes}</p>
        </DetailField>
      )}
    </>
  )
}

function CreditCardDetail({ data }: { data: CreditCardItemData }) {
  return (
    <>
      <DetailField label="Cardholder">
        <PlainValue value={data.cardholder} />
      </DetailField>
      <DetailField label="Card number">
        <SecretValue value={data.number} />
      </DetailField>
      <div className="grid grid-cols-2 gap-3">
        <DetailField label="Expiration">
          <PlainValue value={data.expiration} />
        </DetailField>
        <DetailField label="CVV">
          <SecretValue value={data.cvv} />
        </DetailField>
      </div>
      {data.notes && (
        <DetailField label="Notes">
          <p className="whitespace-pre-wrap text-sm text-text-muted">{data.notes}</p>
        </DetailField>
      )}
    </>
  )
}
