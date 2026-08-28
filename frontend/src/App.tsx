import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from '@/lib/session'
import { FullPageSpinner } from '@/components/full-page-spinner'

// Route-level code splitting: the auth bundle (hash-wasm's Argon2id WASM in
// particular) and the vault bundle don't both need to load on first paint.
const LoginPage = lazy(() => import('@/pages/auth/login-page').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() =>
  import('@/pages/auth/register-page').then((m) => ({ default: m.RegisterPage })),
)
const VerifyEmailPage = lazy(() =>
  import('@/pages/auth/verify-email-page').then((m) => ({ default: m.VerifyEmailPage })),
)
const UnlockPage = lazy(() => import('@/pages/auth/unlock-page').then((m) => ({ default: m.UnlockPage })))
const VaultLayout = lazy(() =>
  import('@/pages/vault/vault-layout').then((m) => ({ default: m.VaultLayout })),
)
const VaultPage = lazy(() => import('@/pages/vault/vault-page').then((m) => ({ default: m.VaultPage })))
const GeneratorPage = lazy(() =>
  import('@/pages/generator-page').then((m) => ({ default: m.GeneratorPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings-page').then((m) => ({ default: m.SettingsPage })),
)
const ImportPage = lazy(() => import('@/pages/import-page').then((m) => ({ default: m.ImportPage })))

function RequireUnlocked({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'signed-out') return <Navigate to="/login" replace />
  if (status === 'locked') return <Navigate to="/unlock" replace />
  return <>{children}</>
}

function RequireSignedOut({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unlocked') return <Navigate to="/" replace />
  if (status === 'locked') return <Navigate to="/unlock" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route
          path="/login"
          element={
            <RequireSignedOut>
              <LoginPage />
            </RequireSignedOut>
          }
        />
        <Route
          path="/register"
          element={
            <RequireSignedOut>
              <RegisterPage />
            </RequireSignedOut>
          }
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/unlock" element={<UnlockPage />} />

        <Route
          element={
            <RequireUnlocked>
              <VaultLayout />
            </RequireUnlocked>
          }
        >
          <Route path="/" element={<VaultPage view="all" />} />
          <Route path="/favorites" element={<VaultPage view="favorites" />} />
          <Route path="/logins" element={<VaultPage view="logins" />} />
          <Route path="/notes" element={<VaultPage view="notes" />} />
          <Route path="/cards" element={<VaultPage view="cards" />} />
          <Route path="/trash" element={<VaultPage view="trash" />} />
          <Route path="/folders/:folderId" element={<VaultPage view="folder" />} />
          <Route path="/generator" element={<GeneratorPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
