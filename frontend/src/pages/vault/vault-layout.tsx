import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Menu } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { AppLogo } from '@/components/app-logo'
import { SidebarNav } from '@/components/sidebar-nav'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export function VaultLayout() {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <div className="flex h-dvh w-full bg-bg">
      <aside className="hidden w-64 shrink-0 border-r border-border md:block">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button className="rounded-md p-1.5 text-text-muted hover:bg-surface" aria-label="Open menu">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <VisuallyHidden>
                <DialogPrimitive.Title>Navigation</DialogPrimitive.Title>
              </VisuallyHidden>
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <AppLogo />
        </header>

        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
