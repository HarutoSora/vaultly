import * as React from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PasswordStrengthMeter } from '@/components/password-strength-meter'
import {
  DEFAULT_GENERATOR_OPTIONS,
  type PasswordGeneratorOptions,
  generatePassword,
} from '@vaultly/shared'

export function GeneratorPage() {
  const [options, setOptions] = React.useState<PasswordGeneratorOptions>(DEFAULT_GENERATOR_OPTIONS)
  const [password, setPassword] = React.useState(() => generatePassword(DEFAULT_GENERATOR_OPTIONS))
  const [copied, setCopied] = React.useState(false)

  const regenerate = React.useCallback((next: PasswordGeneratorOptions) => {
    try {
      setPassword(generatePassword(next))
    } catch {
      // all four types deselected — keep the last valid password on screen
    }
  }, [])

  const updateOption = <K extends keyof PasswordGeneratorOptions>(key: K, value: PasswordGeneratorOptions[K]) => {
    const next = { ...options, [key]: value }
    setOptions(next)
    regenerate(next)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    toast.success('Password copied')
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="font-semibold text-lg text-text">Password Generator</h1>
        <p className="text-sm text-text-muted">
          Generated locally with your browser&apos;s cryptographically secure random number
          generator — never sent anywhere.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-md bg-surface px-3 py-2.5 font-mono text-base text-text">
            {password}
          </p>
          <Button variant="outline" size="icon" onClick={() => regenerate(options)} aria-label="Regenerate">
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy password">
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="px-1 pt-3">
          <PasswordStrengthMeter password={password} />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="length">Length</Label>
          <span className="w-8 text-right font-mono text-sm text-text-muted">{options.length}</span>
        </div>
        <input
          id="length"
          type="range"
          min={8}
          max={64}
          value={options.length}
          onChange={(e) => updateOption('length', Number(e.target.value))}
          className="accent-[var(--color-brand)]"
        />

        <div className="grid grid-cols-2 gap-3 pt-1">
          <ToggleRow
            id="uppercase"
            label="Uppercase (A-Z)"
            checked={options.uppercase}
            onChange={(v) => updateOption('uppercase', v)}
          />
          <ToggleRow
            id="lowercase"
            label="Lowercase (a-z)"
            checked={options.lowercase}
            onChange={(v) => updateOption('lowercase', v)}
          />
          <ToggleRow
            id="numbers"
            label="Numbers (0-9)"
            checked={options.numbers}
            onChange={(v) => updateOption('numbers', v)}
          />
          <ToggleRow
            id="symbols"
            label="Symbols (!@#$)"
            checked={options.symbols}
            onChange={(v) => updateOption('symbols', v)}
          />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal text-text-muted">
        {label}
      </Label>
    </div>
  )
}
