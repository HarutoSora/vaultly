import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 py-1 text-sm text-text shadow-xs transition-[color,box-shadow] outline-none',
        'placeholder:text-text-faint',
        'focus-visible:border-brand focus-visible:shadow-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_var(--color-danger-subtle)]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
