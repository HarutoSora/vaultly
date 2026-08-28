import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text shadow-xs outline-none transition-[color,box-shadow]',
        'placeholder:text-text-faint',
        'focus-visible:border-brand focus-visible:shadow-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
