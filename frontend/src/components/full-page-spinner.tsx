import { Loader2 } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-bg">
      <Loader2 className="size-6 animate-spin text-text-faint" />
    </div>
  )
}
