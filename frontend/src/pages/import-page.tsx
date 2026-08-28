import * as React from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { type ImportedLogin, VaultItemType, parseChromePasswordsCsv } from '@vaultly/shared'
import { Button } from '@/components/ui/button'
import { useCreateVaultItem } from '@/hooks/use-vault'

type Stage =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; fileName: string; items: ImportedLogin[] }
  | { kind: 'importing'; total: number; done: number; failed: number }
  | { kind: 'done'; total: number; failed: number }

export function ImportPage() {
  const [stage, setStage] = React.useState<Stage>({ kind: 'idle' })
  const createItem = useCreateVaultItem()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const text = await file.text()
    try {
      const items = parseChromePasswordsCsv(text)
      if (items.length === 0) {
        setStage({ kind: 'error', message: 'No importable rows found in that file.' })
        return
      }
      setStage({ kind: 'preview', fileName: file.name, items })
    } catch (err) {
      setStage({ kind: 'error', message: err instanceof Error ? err.message : 'Could not read that file.' })
    }
  }

  const runImport = async (items: ImportedLogin[]) => {
    setStage({ kind: 'importing', total: items.length, done: 0, failed: 0 })
    let done = 0
    let failed = 0

    // Sequential on purpose — each item is its own encrypt + API call, and
    // this keeps a readable live progress count instead of firing dozens of
    // requests at once for what's usually a one-time, unhurried action.
    for (const item of items) {
      try {
        await createItem.mutateAsync({
          type: VaultItemType.Login,
          data: { name: item.name, username: item.username, password: item.password, website: item.website, notes: item.notes },
          folderId: null,
          favorite: false,
        })
        done++
      } catch {
        failed++
      }
      setStage({ kind: 'importing', total: items.length, done, failed })
    }

    setStage({ kind: 'done', total: items.length, failed })
    if (failed === 0) {
      toast.success(`Imported ${done} login${done === 1 ? '' : 's'}`)
    } else {
      toast.error(`Imported ${done}, ${failed} failed`)
    }
  }

  const reset = () => {
    setStage({ kind: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="font-semibold text-lg text-text">Import from Chrome</h1>
        <p className="mt-1 text-sm text-text-muted">
          Chrome doesn't let any extension read its saved passwords directly — that's deliberate,
          on Chrome's part, not a Vaultly limitation. Export them yourself, then bring the file
          here.
        </p>
      </div>

      <ol className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
        <li>
          1. Open{' '}
          <code className="rounded bg-surface px-1 py-0.5 text-text">
            chrome://password-manager/passwords
          </code>
        </li>
        <li>2. Click the ⋮ menu → <strong className="text-text">Export passwords</strong> → confirm with your Windows login</li>
        <li>3. Select the downloaded <code className="rounded bg-surface px-1 py-0.5 text-text">.csv</code> file below</li>
      </ol>

      <p className="flex items-start gap-2 rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        That exported file is plaintext on your disk until you delete it. Everything below happens
        in your browser — parsing and encryption included — nothing in it is sent anywhere as
        plaintext, but the file itself is worth deleting once you're done here.
      </p>

      {stage.kind === 'idle' && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center hover:border-brand">
          <UploadCloud className="size-6 text-text-faint" />
          <span className="text-sm font-medium text-text">Choose a CSV file</span>
          <span className="text-xs text-text-faint">or drag one here</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
        </label>
      )}

      {stage.kind === 'error' && (
        <div className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-subtle p-4">
          <p className="text-sm text-danger">{stage.message}</p>
          <Button variant="outline" size="sm" className="w-fit" onClick={reset}>
            Try another file
          </Button>
        </div>
      )}

      {stage.kind === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-text">
            <FileUp className="size-4 text-text-faint" />
            <span className="font-medium">{stage.fileName}</span>
            <span className="text-text-faint">— {stage.items.length} login{stage.items.length === 1 ? '' : 's'} found</span>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {stage.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <span className="truncate font-medium text-text">{item.name}</span>
                <span className="truncate pl-3 text-xs text-text-faint">{item.username || '—'}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={() => void runImport(stage.items)}>
              Import {stage.items.length} login{stage.items.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {stage.kind === 'importing' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised p-6">
          <Loader2 className="size-6 animate-spin text-brand" />
          <p className="text-sm text-text">
            Importing {stage.done} of {stage.total}…
          </p>
        </div>
      )}

      {stage.kind === 'done' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised p-6 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="text-sm text-text">
            Imported {stage.total - stage.failed} of {stage.total} logins
            {stage.failed > 0 && ` (${stage.failed} failed)`}.
          </p>
          <Button variant="outline" size="sm" onClick={reset}>
            Import another file
          </Button>
        </div>
      )}
    </div>
  )
}
