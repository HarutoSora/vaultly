import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap w-fit',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-subtle text-brand',
        secondary: 'border-transparent bg-surface-raised text-text-muted',
        success: 'border-transparent bg-success-subtle text-success',
        danger: 'border-transparent bg-danger-subtle text-danger',
        warning: 'border-transparent bg-warning-subtle text-warning',
        outline: 'border-border text-text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
}

export { Badge, badgeVariants }
