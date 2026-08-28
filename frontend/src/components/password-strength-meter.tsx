import { estimatePasswordStrength } from '@vaultly/shared'
import { cn } from '@/lib/utils'

const COLORS = ['bg-border', 'bg-danger', 'bg-warning', 'bg-brand', 'bg-success']

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const { score, label } = estimatePasswordStrength(password)

  return (
    <div className="flex items-center gap-2 pt-0.5">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={cn('h-1 flex-1 rounded-full bg-border', step <= score && COLORS[score])}
          />
        ))}
      </div>
      <span className="text-xs text-text-faint">{label}</span>
    </div>
  )
}
