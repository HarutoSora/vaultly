import * as React from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The canonical way any secret (password, TOTP, card number, CVV) is shown
 * in the UI: masked by default, an explicit Show toggle, a Copy button with
 * its own visual confirmation. The value itself never goes into a toast,
 * a URL, or anywhere else that might log it — copy confirmation is a plain
 * icon swap, not a message repeating the secret.
 */
export function SecretValue({
  value,
  mono = true,
  masked: initialMasked = true,
}: {
  value: string
  mono?: boolean
  masked?: boolean
}) {
  const [masked, setMasked] = React.useState(initialMasked)
  const [copied, setCopied] = React.useState(false)
  const copyTimeout = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCopy = async () => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    clearTimeout(copyTimeout.current)
    copyTimeout.current = setTimeout(() => setCopied(false), 1600)
  }

  React.useEffect(() => () => clearTimeout(copyTimeout.current), [])

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5">
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm text-text',
          mono && 'font-mono',
          masked && 'select-none',
        )}
      >
        {value ? (masked ? '•'.repeat(Math.min(value.length, 24)) : value) : (
          <span className="text-text-faint">Empty</span>
        )}
      </span>
      {value && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setMasked((m) => !m)}
            aria-label={masked ? 'Show value' : 'Hide value'}
          >
            {masked ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleCopy}
            aria-label="Copy to clipboard"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </Button>
        </>
      )}
    </div>
  )
}
