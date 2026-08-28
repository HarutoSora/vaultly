import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/password-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useCreateVaultItem, useDecryptedFolders, useUpdateVaultItem } from '@/hooks/use-vault'
import { DEFAULT_GENERATOR_OPTIONS, generatePassword } from '@vaultly/shared'
import {
  type CreditCardItemData,
  type DecryptedVaultItem,
  type LoginItemData,
  type SecureNoteItemData,
  VaultItemType,
  emptyItemData,
} from '@vaultly/shared'

export function ItemFormDialog({
  open,
  onOpenChange,
  editingItem,
  defaultFolderId = null,
  defaultType = VaultItemType.Login,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem?: DecryptedVaultItem | null
  defaultFolderId?: string | null
  defaultType?: VaultItemType
}) {
  const isEditing = !!editingItem
  const { folders } = useDecryptedFolders()
  const create = useCreateVaultItem()
  const update = useUpdateVaultItem()

  const [type, setType] = React.useState<VaultItemType>(defaultType)
  const [data, setData] = React.useState(emptyItemData(defaultType))
  const [folderId, setFolderId] = React.useState<string | null>(defaultFolderId)
  const [favorite, setFavorite] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setType(editingItem?.type ?? defaultType)
    setData(editingItem?.data ?? emptyItemData(editingItem?.type ?? defaultType))
    setFolderId(editingItem?.folderId ?? defaultFolderId)
    setFavorite(editingItem?.favorite ?? false)
  }, [open, editingItem, defaultFolderId, defaultType])

  const saving = create.isPending || update.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isEditing) {
        await update.mutateAsync({ id: editingItem.id, data, folderId, favorite })
        toast.success('Item updated')
      } else {
        await create.mutateAsync({ type, data, folderId, favorite })
        toast.success('Item created')
      }
      onOpenChange(false)
    } catch {
      toast.error('Could not save the item. Try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit item' : 'New item'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEditing && (
            <Tabs
              value={String(type)}
              onValueChange={(v) => {
                const next = Number(v) as VaultItemType
                setType(next)
                setData(emptyItemData(next))
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value={String(VaultItemType.Login)} className="flex-1">
                  Login
                </TabsTrigger>
                <TabsTrigger value={String(VaultItemType.SecureNote)} className="flex-1">
                  Secure Note
                </TabsTrigger>
                <TabsTrigger value={String(VaultItemType.CreditCard)} className="flex-1">
                  Card
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {type === VaultItemType.Login && (
            <LoginFields data={data as LoginItemData} onChange={setData} />
          )}
          {type === VaultItemType.SecureNote && (
            <SecureNoteFields data={data as SecureNoteItemData} onChange={setData} />
          )}
          {type === VaultItemType.CreditCard && (
            <CreditCardFields data={data as CreditCardItemData} onChange={setData} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Folder</Label>
              <Select
                value={folderId ?? 'none'}
                onValueChange={(v) => setFolderId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="favorite"
                checked={favorite}
                onCheckedChange={(v) => setFavorite(v === true)}
              />
              <Label htmlFor="favorite">Favorite</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {isEditing ? 'Save changes' : 'Create item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function LoginFields({
  data,
  onChange,
}: {
  data: LoginItemData
  onChange: (data: LoginItemData) => void
}) {
  return (
    <>
      <Field label="Name">
        <Input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. GitHub"
          autoFocus
          required
        />
      </Field>
      <Field label="Username or email">
        <Input value={data.username} onChange={(e) => onChange({ ...data, username: e.target.value })} />
      </Field>
      <Field label="Password">
        <div className="flex gap-2">
          <PasswordField
            value={data.password}
            onChange={(e) => onChange({ ...data, password: e.target.value })}
            autoComplete="new-password"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Generate a password"
            onClick={() => onChange({ ...data, password: generatePassword(DEFAULT_GENERATOR_OPTIONS) })}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </Field>
      <Field label="Website">
        <Input
          type="url"
          value={data.website}
          onChange={(e) => onChange({ ...data, website: e.target.value })}
          placeholder="https://example.com"
        />
      </Field>
      <Field label="Notes">
        <Textarea
          value={data.notes}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          rows={3}
        />
      </Field>
    </>
  )
}

function SecureNoteFields({
  data,
  onChange,
}: {
  data: SecureNoteItemData
  onChange: (data: SecureNoteItemData) => void
}) {
  return (
    <>
      <Field label="Name">
        <Input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          autoFocus
          required
        />
      </Field>
      <Field label="Content">
        <Textarea
          value={data.content}
          onChange={(e) => onChange({ ...data, content: e.target.value })}
          rows={6}
          className="font-mono text-sm"
        />
      </Field>
      <Field label="Notes">
        <Textarea value={data.notes} onChange={(e) => onChange({ ...data, notes: e.target.value })} rows={2} />
      </Field>
    </>
  )
}

function CreditCardFields({
  data,
  onChange,
}: {
  data: CreditCardItemData
  onChange: (data: CreditCardItemData) => void
}) {
  return (
    <>
      <Field label="Name">
        <Input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. Personal Visa"
          autoFocus
          required
        />
      </Field>
      <Field label="Cardholder name">
        <Input value={data.cardholder} onChange={(e) => onChange({ ...data, cardholder: e.target.value })} />
      </Field>
      <Field label="Card number">
        <Input
          value={data.number}
          onChange={(e) => onChange({ ...data, number: e.target.value })}
          inputMode="numeric"
          className="font-mono"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiration">
          <Input
            value={data.expiration}
            onChange={(e) => onChange({ ...data, expiration: e.target.value })}
            placeholder="MM/YY"
            className="font-mono"
          />
        </Field>
        <Field label="CVV">
          <PasswordField
            value={data.cvv}
            onChange={(e) => onChange({ ...data, cvv: e.target.value })}
            autoComplete="off"
            inputMode="numeric"
          />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={data.notes} onChange={(e) => onChange({ ...data, notes: e.target.value })} rows={2} />
      </Field>
    </>
  )
}
