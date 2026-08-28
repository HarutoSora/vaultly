import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Loader2, LogOut } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { PasswordField } from '@/components/password-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useSession } from '@/lib/session'

const schema = z.object({ password: z.string().min(1, 'Enter your master password.') })
type FormValues = z.infer<typeof schema>

export function UnlockPage() {
  const { status, email, unlock, signOut } = useSession()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (status === 'signed-out') return <Navigate to="/login" replace />
  if (status === 'unlocked') return <Navigate to="/" replace />

  const onSubmit = async (values: FormValues) => {
    try {
      await unlock(values.password)
      navigate('/', { replace: true })
    } catch {
      setError('password', { message: 'Incorrect master password.' })
    }
  }

  return (
    <AuthShell
      title="Vault locked"
      description={email ?? undefined}
      footer={
        <button
          onClick={() => void signOut()}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text"
        >
          <LogOut className="size-3.5" /> Sign in as someone else
        </button>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Master password</Label>
          <PasswordField
            id="password"
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Unlock
        </Button>
      </form>
    </AuthShell>
  )
}
