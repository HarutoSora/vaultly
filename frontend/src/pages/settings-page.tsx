import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import * as authApi from '@vaultly/shared'
import { AUTO_LOCK_OPTIONS, useSession } from '@/lib/session'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const { email, autoLockMinutes, setAutoLockMinutes, signOut } = useSession()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const handleSignOutAll = async () => {
    try {
      await authApi.logoutAll()
      await signOut()
      navigate('/login', { replace: true })
      toast.success('Signed out of every device')
    } catch {
      toast.error('Could not sign out everywhere. Try again.')
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-6 overflow-y-auto p-6">
      <h1 className="font-semibold text-lg text-text">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text">Account</h2>
        <div className="rounded-lg border border-border bg-surface-raised p-4 text-sm shadow-sm">
          <p className="text-text-faint">Signed in as</p>
          <p className="font-medium text-text">{email}</p>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-md border border-border bg-surface-raised py-3 text-xs font-medium text-text-muted transition-colors',
                theme === opt.value && 'border-brand bg-brand-subtle text-brand',
              )}
            >
              <opt.icon className="size-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text">Security</h2>
        <div className="flex flex-col gap-1.5">
          <Label>Auto-lock</Label>
          <Select value={String(autoLockMinutes)} onValueChange={(v) => setAutoLockMinutes(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_LOCK_OPTIONS.map((o) => (
                <SelectItem key={o.minutes} value={String(o.minutes)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-text-muted">
            Locks the vault after this much inactivity, or immediately when this tab is hidden if set
            to Immediately.
          </p>
        </div>

        <Button variant="outline" onClick={handleSignOutAll} className="mt-1 w-fit gap-2 text-danger hover:text-danger">
          <LogOut className="size-4" /> Sign out of all devices
        </Button>
      </section>
    </div>
  )
}
