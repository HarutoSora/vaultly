import * as React from 'react'
import { DEFAULT_GENERATOR_OPTIONS, faviconUrl, generatePassword } from '@vaultly/shared'
import type { ExtensionStatus, MatchingLogin } from '../messages'
import { getActiveTabId, getActiveTabOrigin, send } from './background-client'

// TODO: point at the real deployed web app origin for a production build.
const WEB_VAULT_URL = 'https://local.passwordvault.com'

type Tab = 'logins' | 'generator'

export default function App() {
  const [status, setStatus] = React.useState<ExtensionStatus>('loading')
  const [email, setEmail] = React.useState<string | null>(null)
  const [origin, setOrigin] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<Tab>('logins')

  const refreshStatus = React.useCallback(async () => {
    const result = await send<{ status: ExtensionStatus; email: string | null }>({ type: 'GET_STATUS' })
    setStatus(result.status)
    setEmail(result.email)
  }, [])

  React.useEffect(() => {
    refreshStatus()
    getActiveTabOrigin().then(setOrigin)
  }, [refreshStatus])

  return (
    <div className="popup">
      <Header email={email} status={status} onLocked={refreshStatus} />
      {status === 'loading' && (
        <div className="center">
          <p className="muted">Loading…</p>
        </div>
      )}
      {status === 'signed-out' && <SignedOut />}
      {status === 'locked' && <Locked onUnlocked={refreshStatus} />}
      {status === 'unlocked' && (
        <>
          <div className="body" style={{ paddingBottom: 0 }}>
            <div className="tabs">
              <button className={tab === 'logins' ? 'active' : ''} onClick={() => setTab('logins')}>
                Logins
              </button>
              <button className={tab === 'generator' ? 'active' : ''} onClick={() => setTab('generator')}>
                Generator
              </button>
            </div>
          </div>
          {tab === 'logins' ? <LoginsPanel origin={origin} /> : <GeneratorPanel />}
        </>
      )}
      <Footer />
    </div>
  )
}

function Header({
  email,
  status,
  onLocked,
}: {
  email: string | null
  status: ExtensionStatus
  onLocked: () => void
}) {
  const lock = async () => {
    await send({ type: 'LOCK' })
    onLocked()
  }

  return (
    <div className="header">
      <div className="brand">
        <img src="/icons/icon-32.png" alt="" className="dot" width={20} height={20} />
        Vaultly
      </div>
      {status === 'unlocked' && (
        <button className="icon-btn" title={`Lock (${email})`} onClick={lock}>
          Lock
        </button>
      )}
    </div>
  )
}

function Footer() {
  return (
    <div className="footer">
      <span>Zero-knowledge</span>
      <a href={WEB_VAULT_URL} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
        Open web vault ↗
      </a>
    </div>
  )
}

function SignedOut() {
  return (
    <div className="center">
      <h1>Not signed in</h1>
      <p className="muted">Sign in or create an account in the Vaultly web app first.</p>
      <button
        className="primary"
        onClick={() => chrome.tabs.create({ url: `${WEB_VAULT_URL}/login` })}
      >
        Open web vault
      </button>
    </div>
  )
}

function Locked({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await send({ type: 'UNLOCK', password })
      onUnlocked()
    } catch (err) {
      // A wrong password fails inside AES-GCM decryption with a generic
      // OperationError — anything else (network, auth, a real bug) throws
      // its own message, which is worth showing rather than masking as
      // "wrong password" every time regardless of what actually happened.
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

  return (
    <form className="body" onSubmit={unlock}>
      <h1>Vault locked</h1>
      <div className="field">
        <label htmlFor="mp">Master password</label>
        <input
          id="mp"
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
    </form>
  )
}

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
