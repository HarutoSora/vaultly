import { ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(600px circle at 20% 10%, var(--color-brand-subtle), transparent 60%), radial-gradient(500px circle at 85% 85%, var(--color-brand-subtle), transparent 55%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-brand-contrast shadow-md">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-text">{title}</h1>
            {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-6 shadow-sm">
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-text-muted">{footer}</div>}
      </motion.div>
    </div>
  )
}
