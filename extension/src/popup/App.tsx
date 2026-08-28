import * as React from 'react'
import { DEFAULT_GENERATOR_OPTIONS, faviconUrl, generatePassword } from '@vaultly/shared'
import type { LoginItemData } from '@vaultly/shared'
import type { ExtensionMode, ExtensionStatus, MatchingLogin, StatusResponse } from '../messages'
import { getActiveTabId, getActiveTabOrigin, send } from './background-client'

// TODO: point at the real deployed web app origin for a production build.
const WEB_VAULT_URL = 'https://local.passwordvault.com'

type Tab = 'logins' | 'vault' | 'generator'

export default function App() {
  const [statusInfo, setStatusInfo] = React.useState<StatusResponse>({
    status: 'loading',
    mode: null,
    email: null,
    hasLocalVault: false,
  })
  const [origin, setOrigin] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<Tab>('logins')
  // Explicit escape hatches from a locked screen — "use the other mode
  // instead" — independent of whichever mode getStatus() reports as active.
  const [forceFlow, setForceFlow] = React.useState<'server-login' | 'local-setup' | 'local-unlock' | null>(null)

  const refreshStatus = React.useCallback(async () => {
    const result = await send<StatusResponse>({ type: 'GET_STATUS' })
    setStatusInfo(result)
    setForceFlow(null)
  }, [])

  React.useEffect(() => {
    refreshStatus()
    getActiveTabOrigin().then(setOrigin)
  }, [refreshStatus])

  const { status, mode, email, hasLocalVault } = statusInfo

  return (
    <div className="popup">
      <Header mode={mode} email={email} status={status} onLocked={refreshStatus} />
      {status === 'loading' && (
        <div className="center">
          <p className="muted">Loading…</p>
        </div>
      )}
      {status === 'no-vault' && !forceFlow && <Chooser onChoose={setForceFlow} />}
      {status === 'no-vault' && forceFlow === 'server-login' && (
        <ServerLogin onUnlocked={refreshStatus} onBack={() => setForceFlow(null)} />
      )}
      {status === 'no-vault' && forceFlow === 'local-setup' && (
        <LocalSetup onCreated={refreshStatus} onBack={() => setForceFlow(null)} />
      )}
      {status === 'locked' && !forceFlow && mode === 'local' && (
        <LocalUnlock onUnlocked={refreshStatus} onUseAccountInstead={() => setForceFlow('server-login')} />
      )}
      {status === 'locked' && !forceFlow && mode === 'server' && (
        <ServerLogin
          onUnlocked={refreshStatus}
          onUseLocalInstead={
            hasLocalVault ? () => setForceFlow('local-unlock') : () => setForceFlow('local-setup')
          }
        />
      )}
      {status === 'locked' && forceFlow === 'server-login' && (
        <ServerLogin onUnlocked={refreshStatus} onBack={() => setForceFlow(null)} />
      )}
      {status === 'locked' && forceFlow === 'local-unlock' && (
        <LocalUnlock onUnlocked={refreshStatus} onBack={() => setForceFlow(null)} />
      )}
      {status === 'locked' && forceFlow === 'local-setup' && (
        <LocalSetup onCreated={refreshStatus} onBack={() => setForceFlow(null)} />
      )}
      {status === 'unlocked' && (
        <>
          <div className="body" style={{ paddingBottom: 0 }}>
            <div className="tabs">
              <button className={tab === 'logins' ? 'active' : ''} onClick={() => setTab('logins')}>
                This site
              </button>
              <button className={tab === 'vault' ? 'active' : ''} onClick={() => setTab('vault')}>
                All logins
              </button>
              <button className={tab === 'generator' ? 'active' : ''} onClick={() => setTab('generator')}>
                Generator
              </button>
            </div>
          </div>
          {tab === 'logins' && <LoginsPanel origin={origin} />}
          {tab === 'vault' && <VaultPanel />}
          {tab === 'generator' && <GeneratorPanel />}
        </>
      )}
      <Footer mode={mode} status={status} />
    </div>
  )
}

function Header({
  mode,
  email,
  status,
  onLocked,
}: {
  mode: ExtensionMode | null
  email: string | null
  status: ExtensionStatus
  onLocked: () => void
}) {
  const lock = async () => {
    await send({ type: 'LOCK' })
    onLocked()
  }

  const title = mode === 'server' ? email ?? 'Account' : mode === 'local' ? 'Local vault (this device)' : undefined

  return (
    <div className="header">
      <div className="brand">
        <img src="/icons/icon-32.png" alt="" className="dot" width={20} height={20} />
        Vaultly
      </div>
      {status === 'unlocked' && (
        <button className="icon-btn" title={`Lock${title ? ` (${title})` : ''}`} onClick={lock}>
          Lock
        </button>
      )}
    </div>
  )
}

function Footer({ mode, status }: { mode: ExtensionMode | null; status: ExtensionStatus }) {
  return (
    <div className="footer">
      <span>{mode === 'local' ? 'Local-only — no server' : 'Zero-knowledge'}</span>
      {status !== 'no-vault' && mode !== 'local' && (
        <a href={WEB_VAULT_URL} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          Open web vault ↗
        </a>
      )}
    </div>
  )
}

// ---- first-run chooser --------------------------------------------------

function Chooser({ onChoose }: { onChoose: (flow: 'server-login' | 'local-setup') => void }) {
  return (
    <div className="body">
      <h1>Get started</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        Choose how you want to use Vaultly on this device.
      </p>

      <button className="choice-card" onClick={() => onChoose('local-setup')}>
        <div className="choice-title">Local vault</div>
        <div className="choice-sub">
          No account, nothing to host. Encrypted with a master password, stored only in this
          browser. No sync, no recovery if you forget the password.
        </div>
      </button>

      <button className="choice-card" onClick={() => onChoose('server-login')}>
        <div className="choice-title">Sign in with account</div>
        <div className="choice-sub">Syncs across devices via your Vaultly account.</div>
      </button>
    </div>
  )
}

// ---- server-mode auth (existing account) --------------------------------

function ServerLogin({
  onUnlocked,
  onBack,
  onUseLocalInstead,
}: {
  onUnlocked: () => void
  onBack?: () => void
  onUseLocalInstead?: () => void
}) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await send({ type: 'LOGIN', email, password })
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="body" onSubmit={submit}>
      <h1>Sign in with account</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        No account yet? <a href={`${WEB_VAULT_URL}/register`} target="_blank" rel="noreferrer">Create one on the web</a>.
      </p>
      <div className="field">
        <label htmlFor="sl-email">Email</label>
        <input id="sl-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="sl-password">Master password</label>
        <input
          id="sl-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="primary" type="submit" disabled={busy || !email || !password}>
        Sign in
      </button>
      {(onBack || onUseLocalInstead) && (
        <button
          type="button"
          className="link-btn"
          onClick={() => (onBack ? onBack() : onUseLocalInstead?.())}
        >
          {onBack ? '← Back' : 'Use a local vault instead'}
        </button>
      )}
    </form>
  )
}

// ---- local-mode setup (first time on this device) ------------------------

function LocalSetup({ onCreated, onBack }: { onCreated: () => void; onBack?: () => void }) {
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setBusy(true)
    try {
      await send({ type: 'SETUP_LOCAL_VAULT', password })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the local vault.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="body" onSubmit={submit}>
      <h1>Create a local vault</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        Stored only in this browser. There is no password reset — losing this password means losing
        the vault.
      </p>
      <div className="field">
        <label htmlFor="ls-password">Master password</label>
        <input
          id="ls-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="ls-confirm">Confirm master password</label>
        <input
          id="ls-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="primary" type="submit" disabled={busy || !password || !confirm}>
        Create vault
      </button>
      {onBack && (
        <button type="button" className="link-btn" onClick={onBack}>
          ← Back
        </button>
      )}
    </form>
  )
}

// ---- local-mode unlock (vault already exists) -----------------------------

function LocalUnlock({
  onUnlocked,
  onBack,
  onUseAccountInstead,
}: {
  onUnlocked: () => void
  onBack?: () => void
  onUseAccountInstead?: () => void
}) {
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = React.useState(false)

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await send({ type: 'UNLOCK_LOCAL_VAULT', password })
      onUnlocked()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        message.toLowerCase().includes('operation') || message.toLowerCase().includes('decrypt')
          ? 'Incorrect master password.'
          : `Could not unlock: ${message}`,
      )
    } finally {
      setBusy(false)
    }
  }

  const resetVault = async () => {
    await send({ type: 'RESET_LOCAL_VAULT' })
    onUnlocked() // re-fetches status; with the vault gone this lands back on the chooser
  }

  return (
    <form className="body" onSubmit={unlock}>
      <h1>Local vault locked</h1>
      <div className="field">
        <label htmlFor="lu-password">Master password</label>
        <input
          id="lu-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="primary" type="submit" disabled={busy || !password}>
        Unlock
      </button>
      {(onBack || onUseAccountInstead) && (
        <button
          type="button"
          className="link-btn"
          onClick={() => (onBack ? onBack() : onUseAccountInstead?.())}
        >
          {onBack ? '← Back' : 'Sign in with an account instead'}
        </button>
      )}

      <div className="danger-zone">
        {!confirmingReset ? (
          <button type="button" className="link-btn danger" onClick={() => setConfirmingReset(true)}>
            Forgot password? Reset this vault
          </button>
        ) : (
          <div className="confirm-box">
            <p className="muted">This permanently deletes every item in this local vault. There is no undo.</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="secondary" onClick={() => setConfirmingReset(false)}>
                Cancel
              </button>
              <button type="button" className="danger-btn" onClick={resetVault}>
                Delete vault
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}

// ---- unlocked: current-site matches --------------------------------------

function LoginsPanel({ origin }: { origin: string | null }) {
  const [logins, setLogins] = React.useState<MatchingLogin[] | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!origin) {
      setLogins([])
      return
    }
    send<MatchingLogin[]>({ type: 'LIST_LOGINS_FOR_ORIGIN', origin }).then(setLogins)
  }, [origin])

  const fill = async (login: MatchingLogin) => {
    const tabId = await getActiveTabId()
    if (tabId === null) return
    chrome.tabs.sendMessage(tabId, {
      type: 'FILL_CREDENTIALS',
      username: login.data.username,
      password: login.data.password,
    })
    window.close()
  }

  const copy = async (login: MatchingLogin) => {
    await navigator.clipboard.writeText(login.data.password)
    setCopiedId(login.id)
    setTimeout(() => setCopiedId(null), 1200)
  }

  return (
    <div className="body">
      {logins === null && <p className="muted">Loading…</p>}
      {logins?.length === 0 && (
        <p className="muted">No saved logins for {origin ? new URL(origin).hostname : 'this site'}.</p>
      )}
      {logins?.map((login) => (
        <div className="login-item" key={login.id}>
          <SiteIcon website={login.data.website} />
          <div className="meta">
            <div className="name">{login.data.name || login.data.username}</div>
            <div className="sub">{login.data.username}</div>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => copy(login)} title="Copy password">
              {copiedId === login.id ? '✓' : 'Copy'}
            </button>
            <button className="secondary" onClick={() => fill(login)} title="Fill into page">
              Fill
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- unlocked: full vault (view/add/edit/delete every saved login) --------

const EMPTY_LOGIN: LoginItemData = { name: '', username: '', password: '', website: '', notes: '' }

function VaultPanel() {
  const [logins, setLogins] = React.useState<MatchingLogin[] | null>(null)
  const [editing, setEditing] = React.useState<MatchingLogin | 'new' | null>(null)

  const reload = React.useCallback(() => {
    send<MatchingLogin[]>({ type: 'LIST_ALL_LOGINS' }).then(setLogins)
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  if (editing) {
    return (
      <LoginEditor
        initial={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null)
          reload()
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="body">
      <button className="secondary" onClick={() => setEditing('new')}>
        + Add login
      </button>
      {logins === null && <p className="muted">Loading…</p>}
      {logins?.length === 0 && <p className="muted">No saved logins yet.</p>}
      {logins?.map((login) => (
        <div className="login-item" key={login.id}>
          <SiteIcon website={login.data.website} />
          <div className="meta">
            <div className="name">{login.data.name || login.data.username}</div>
            <div className="sub">{login.data.username}</div>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setEditing(login)} title="Edit">
              Edit
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function LoginEditor({
  initial,
  onDone,
  onCancel,
}: {
  initial: MatchingLogin | null
  onDone: () => void
  onCancel: () => void
}) {
  const [data, setData] = React.useState<LoginItemData>(initial?.data ?? EMPTY_LOGIN)
  const [busy, setBusy] = React.useState(false)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  const field = (key: keyof LoginItemData) => ({
    value: data[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setData({ ...data, [key]: e.target.value }),
  })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (initial) {
        await send({ type: 'UPDATE_LOGIN', id: initial.id, data })
      } else {
        await send({ type: 'CREATE_LOGIN', data })
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!initial) return
    await send({ type: 'DELETE_LOGIN', id: initial.id })
    onDone()
  }

  return (
    <form className="body" onSubmit={save}>
      <h1>{initial ? 'Edit login' : 'New login'}</h1>
      <div className="field">
        <label>Name</label>
        <input placeholder="e.g. GitHub" autoFocus required {...field('name')} />
      </div>
      <div className="field">
        <label>Username</label>
        <input {...field('username')} />
      </div>
      <div className="field">
        <label>Password</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" className="mono" style={{ flex: 1 }} {...field('password')} />
          <button
            type="button"
            className="secondary"
            style={{ width: 'auto', padding: '0 10px' }}
            onClick={() => setData({ ...data, password: generatePassword(DEFAULT_GENERATOR_OPTIONS) })}
          >
            Gen
          </button>
        </div>
      </div>
      <div className="field">
        <label>Website</label>
        <input placeholder="https://example.com" {...field('website')} />
      </div>
      <button className="primary" type="submit" disabled={busy || !data.name}>
        {initial ? 'Save changes' : 'Create login'}
      </button>
      <button type="button" className="link-btn" onClick={onCancel}>
        Cancel
      </button>

      {initial && (
        <div className="danger-zone">
          {!confirmingDelete ? (
            <button type="button" className="link-btn danger" onClick={() => setConfirmingDelete(true)}>
              Delete this login
            </button>
          ) : (
            <div className="confirm-box">
              <p className="muted">This can&apos;t be undone.</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button type="button" className="danger-btn" onClick={remove}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}

// ---- generator ------------------------------------------------------------

function GeneratorPanel() {
  const [password, setPassword] = React.useState(() => generatePassword(DEFAULT_GENERATOR_OPTIONS))
  const [copied, setCopied] = React.useState(false)

  const regenerate = () => setPassword(generatePassword(DEFAULT_GENERATOR_OPTIONS))

  const copy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="body">
      <div className="generated">{password}</div>
      <button className="secondary" onClick={regenerate}>
        Regenerate
      </button>
      <button className="primary" onClick={copy}>
        {copied ? 'Copied!' : 'Copy password'}
      </button>
    </div>
  )
}

/** The site's own favicon when it loads, falling back to a generic glyph — same approach as the web app's VaultItemIcon, no third-party favicon service. */
function SiteIcon({ website }: { website: string }) {
  const [failed, setFailed] = React.useState(false)
  const src = faviconUrl(website)

  if (!src || failed) {
    return <div className="icon">🔑</div>
  }

  return (
    <div className="icon">
      <img
        src={src}
        alt=""
        width={16}
        height={16}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
