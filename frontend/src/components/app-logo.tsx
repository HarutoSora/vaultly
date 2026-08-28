import { cn } from '@/lib/utils'

export function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-1', className)}>
      <svg viewBox="0 0 32 32" fill="none" className="size-6 shrink-0">
        <rect width="32" height="32" rx="8" fill="var(--color-brand)" />
        <path
          d="M16 6c-3.31 0-6 2.69-6 6v3H9a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V16a1 1 0 0 0-1-1h-1v-3c0-3.31-2.69-6-6-6Zm0 2.5c1.93 0 3.5 1.57 3.5 3.5v3h-7v-3c0-1.93 1.57-3.5 3.5-3.5Z"
          fill="var(--color-brand-contrast)"
        />
        <circle cx="16" cy="21" r="2" fill="var(--color-brand)" />
      </svg>
      <span className="font-semibold text-text">Vaultly</span>
    </div>
  )
}
