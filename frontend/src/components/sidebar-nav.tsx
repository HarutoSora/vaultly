import * as React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CreditCard,
  Folder as FolderIcon,
  KeyRound,
  Lock,
  Plus,
  Settings,
  Star,
  StickyNote,
  Trash2,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/session'
import { useCreateFolder, useDecryptedFolders } from '@/hooks/use-vault'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/app-logo'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const primaryLinks = [
  { to: '/', label: 'All Items', icon: KeyRound, end: true },
  { to: '/favorites', label: 'Favorites', icon: Star },
  { to: '/logins', label: 'Logins', icon: KeyRound },
  { to: '/notes', label: 'Secure Notes', icon: StickyNote },
  { to: '/cards', label: 'Credit Cards', icon: CreditCard },
]

const toolLinks = [
  { to: '/generator', label: 'Generator', icon: Wand2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
          isActive ? 'bg-brand-subtle text-brand' : 'text-text-muted hover:bg-surface hover:text-text',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { email, lock } = useSession()
  const navigate = useNavigate()
  const { folders } = useDecryptedFolders()
  const createFolder = useCreateFolder()
  const [newFolderOpen, setNewFolderOpen] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState('')

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolder.mutateAsync(newFolderName.trim())
      setNewFolderName('')
      setNewFolderOpen(false)
    } catch {
      toast.error('Could not create the folder.')
    }
  }

  const handleLock = () => {
    lock()
    navigate('/unlock')
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <AppLogo />

      <nav className="flex flex-col gap-0.5">
        {primaryLinks.map((l) => (
          <NavItem key={l.to} {...l} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2.5">
          <span className="text-xs font-medium text-text-faint">Folders</span>
          <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
            <DialogTrigger asChild>
              <button
                className="rounded-sm p-0.5 text-text-faint hover:bg-surface hover:text-text"
                aria-label="New folder"
              >
                <Plus className="size-3.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>New folder</DialogTitle>
              </DialogHeader>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <DialogFooter>
                <Button onClick={handleCreateFolder} disabled={createFolder.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <nav className="flex flex-col gap-0.5">
          {folders.map((f) => (
            <NavItem
              key={f.id}
              to={`/folders/${f.id}`}
              label={f.name}
              icon={FolderIcon}
              onNavigate={onNavigate}
            />
          ))}
          {folders.length === 0 && (
            <p className="px-2.5 text-xs text-text-faint">No folders yet.</p>
          )}
        </nav>
      </div>

      <div className="flex flex-col gap-0.5">
        {toolLinks.map((l) => (
          <NavItem key={l.to} {...l} onNavigate={onNavigate} />
        ))}
        <NavItem to="/trash" label="Trash" icon={Trash2} onNavigate={onNavigate} />
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
        <p className="truncate px-2.5 text-xs text-text-faint">{email}</p>
        <Button variant="outline" size="sm" onClick={handleLock} className="justify-start gap-2.5">
          <Lock className="size-4" /> Lock vault
        </Button>
      </div>
    </div>
  )
}
