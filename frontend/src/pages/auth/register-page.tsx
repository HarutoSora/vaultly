import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { PasswordField } from '@/components/password-field'
import { PasswordStrengthMeter } from '@/components/password-strength-meter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@vaultly/shared'
import * as authApi from '@vaultly/shared'

const schema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(12, 'Use at least 12 characters — this key protects everything else.'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '' } })

  const password = watch('password')

  const onSubmit = async (values: FormValues) => {
    try {
      await authApi.register(values.email, values.password)
      navigate('/verify-email', { state: { email: values.email }, replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not create your account.'
      toast.error(message)
    }
  }

  return (
    <AuthShell
      title="Create your vault"
      description="Your master password never leaves this device."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Master password</Label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          <PasswordStrengthMeter password={password} />
          {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm master password</Label>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-danger">{errors.confirmPassword.message}</p>
          )}
        </div>

        <p className="rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning">
          There is no password reset. If you forget your master password, your vault cannot be
          recovered — by us or anyone else.
        </p>

        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
