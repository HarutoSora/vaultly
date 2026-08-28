import * as React from 'react'
import * as authApi from '@vaultly/shared'

export type VaultStatus = 'loading' | 'signed-out' | 'locked' | 'unlocked'

export const AUTO_LOCK_STORAGE_KEY = 'pv-auto-lock-minutes'
export const AUTO_LOCK_OPTIONS = [
  { label: 'Immediately', minutes: 0 },
  { label: 'After 1 minute', minutes: 1 },
  { label: 'After 5 minutes', minutes: 5 },
  { label: 'After 15 minutes', minutes: 15 },
  { label: 'After 30 minutes', minutes: 30 },
] as const

interface SessionContextValue {
  status: VaultStatus
  email: string | null
  userId: string | null
  vaultEncryptionKey: Uint8Array | null
  autoLockMinutes: number
  setAutoLockMinutes: (minutes: number) => void
  loginAndUnlock: (email: string, password: string, deviceName?: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  signOut: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

function readAutoLockMinutes(): number {
  const raw = localStorage.getItem(AUTO_LOCK_STORAGE_KEY)
  if (raw === null) return 5 // nothing chosen yet — NOT the same as an explicit "Immediately" (0)
  const stored = Number(raw)
  return AUTO_LOCK_OPTIONS.some((o) => o.minutes === stored) ? stored : 5
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<VaultStatus>('loading')
  const [email, setEmail] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [vek, setVek] = React.useState<Uint8Array | null>(null)
  const [autoLockMinutes, setAutoLockMinutesState] = React.useState(readAutoLockMinutes)

  React.useEffect(() => {
    let cancelled = false
    authApi.fetchCurrentUser().then((me) => {
      if (cancelled) return
      if (me) {
        setUserId(me.userId)
        setEmail(me.email)
        setStatus('locked') // valid session, but the VEK only ever lives in memory from a fresh unlock
      } else {
        setStatus('signed-out')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const lock = React.useCallback(() => {
    setVek((prev) => {
      prev?.fill(0) // best-effort scrub before dropping the reference
      return null
    })
    setStatus((prev) => (prev === 'unlocked' ? 'locked' : prev))
  }, [])

  const loginAndUnlock = React.useCallback(
    async (loginEmail: string, password: string, deviceName?: string) => {
      const session = await authApi.login(loginEmail, password, deviceName)
      setUserId(session.userId)
      setEmail(session.email)
      setVek(session.vaultEncryptionKey)
      setStatus('unlocked')
    },
    [],
  )

  const unlock = React.useCallback(async (password: string) => {
    const key = await authApi.unlockVault(password)
    setVek(key)
    setStatus('unlocked')
  }, [])

  const signOut = React.useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setVek((prev) => {
        prev?.fill(0)
        return null
      })
      setUserId(null)
      setEmail(null)
      setStatus('signed-out')
    }
  }, [])

  const setAutoLockMinutes = React.useCallback((minutes: number) => {
    localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes))
    setAutoLockMinutesState(minutes)
  }, [])

  // Idle-based auto-lock.
  React.useEffect(() => {
    if (status !== 'unlocked') return

    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      if (autoLockMinutes === 0) return
      timer = setTimeout(lock, autoLockMinutes * 60_000)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [status, autoLockMinutes, lock])

  // Lock immediately when the tab is hidden and auto-lock is set to "Immediately".
  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && autoLockMinutes === 0) lock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [autoLockMinutes, lock])

  const value = React.useMemo<SessionContextValue>(
    () => ({
      status,
      email,
      userId,
      vaultEncryptionKey: vek,
      autoLockMinutes,
      setAutoLockMinutes,
      loginAndUnlock,
      unlock,
      lock,
      signOut,
    }),
    [status, email, userId, vek, autoLockMinutes, setAutoLockMinutes, loginAndUnlock, unlock, lock, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}
