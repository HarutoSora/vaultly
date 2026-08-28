import * as React from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@vaultly/shared'
import * as authApi from '@vaultly/shared'

export function VerifyEmailPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const email = (location.state as { email?: string } | null)?.email
  const linkToken = searchParams.get('token')

  const [code, setCode] = React.useState(linkToken ?? '')
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'done'>('idle')

  const submit = React.useCallback(async (token: string) => {
    if (!token.trim()) return
    setStatus('submitting')
    try {
      await authApi.verifyEmail(token.trim())
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      toast.error(err instanceof ApiError ? err.message : 'That code is invalid or expired.')
    }
  }, [])

  React.useEffect(() => {
    if (linkToken) void submit(linkToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken])

  if (status === 'done') {
    return (
      <AuthShell title="Email verified">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <p className="text-sm text-text-muted">
            Your email is confirmed. You can sign in now.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Continue to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Check your email"
      description={
        email ? `We sent a verification code to ${email}.` : 'Enter the verification code we emailed you.'
      }
    >
      <div className="mb-4 flex justify-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <MailCheck className="size-5" />
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(code)
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste the code from your email"
            className="font-mono text-sm"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={status === 'submitting' || !code.trim()}>
          {status === 'submitting' && <Loader2 className="size-4 animate-spin" />}
          Verify email
        </Button>
      </form>
    </AuthShell>
  )
}
