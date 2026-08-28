/**
 * Runs on every http(s) page. Two jobs only:
 *  1. Fill credentials into the page's own form fields — but only when told
 *     to by the popup (a user's explicit click), never automatically.
 *  2. Notice a login form being submitted and, only if the vault is
 *     unlocked and this exact origin+username isn't already saved, offer to
 *     save it via a small in-page prompt.
 * <para/>
 * Never sends page content anywhere except the two messages below, and
 * never reads or writes anything for an origin other than the page it's
 * running on — window.location.origin is the only origin this script ever
 * has, so there's no cross-origin credential leakage to guard against here.
 */

function findPasswordField(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('input[type="password"]')
}

function findUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  const form = passwordField.closest('form')
  const scope: ParentNode = form ?? document
  const candidates = Array.from(
    scope.querySelectorAll<HTMLInputElement>(
      'input[type="email"], input[type="text"], input[autocomplete="username"]',
    ),
  )
  // Prefer the field immediately before the password field in document order.
  const passwordIndex = candidates.length
    ? Array.from(scope.querySelectorAll('input')).indexOf(passwordField)
    : -1
  let best: HTMLInputElement | null = null
  let bestDistance = Infinity
  for (const c of candidates) {
    const allInputs = Array.from(scope.querySelectorAll('input'))
    const distance = passwordIndex - allInputs.indexOf(c)
    if (distance > 0 && distance < bestDistance) {
      best = c
      bestDistance = distance
    }
  }
  return best ?? candidates[0] ?? null
}

function setNativeValue(input: HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(input) as object
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillCredentials(username: string, password: string) {
  const passwordField = findPasswordField()
  if (!passwordField) return
  const usernameField = findUsernameField(passwordField)
  if (usernameField && username) setNativeValue(usernameField, username)
  setNativeValue(passwordField, password)
}

// ---- save prompt banner (shadow DOM so the host page's CSS can't touch it) ----

function showSavePrompt(origin: string, username: string, password: string) {
  if (document.getElementById('vaultly-save-prompt-host')) return

  const host = document.createElement('div')
  host.id = 'vaultly-save-prompt-host'
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;'
  const shadow = host.attachShadow({ mode: 'closed' })

  shadow.innerHTML = `
    <style>
      .card { font-family: system-ui, sans-serif; background:#18181f; color:#f2f2f5; border:1px solid #33333f;
        border-radius:10px; padding:14px 16px; width:280px; box-shadow:0 12px 32px rgba(0,0,0,.35); }
      .title { font-weight:600; font-size:14px; margin-bottom:4px; }
      .sub { font-size:12px; color:#a3a3ad; margin-bottom:12px; word-break:break-all; }
      .row { display:flex; gap:8px; }
      button { flex:1; font-size:13px; padding:6px 10px; border-radius:6px; border:1px solid transparent; cursor:pointer; }
      .save { background:#635bff; color:white; }
      .dismiss { background:transparent; color:#a3a3ad; border-color:#33333f; }
    </style>
    <div class="card">
      <div class="title">Save this password in Vaultly?</div>
      <div class="sub">${username} on ${new URL(origin).hostname}</div>
      <div class="row">
        <button class="dismiss" id="dismiss">Not now</button>
        <button class="save" id="save">Save</button>
      </div>
    </div>
  `

  shadow.getElementById('dismiss')?.addEventListener('click', () => host.remove())
  shadow.getElementById('save')?.addEventListener('click', () => {
    const data = {
      name: new URL(origin).hostname,
      username,
      password,
      website: origin,
      notes: '',
    }
    chrome.runtime.sendMessage({ type: 'SAVE_LOGIN', data })
    host.remove()
  })

  document.documentElement.appendChild(host)
  setTimeout(() => host.remove(), 20_000) // don't linger forever if ignored
}

document.addEventListener(
  'submit',
  (event) => {
    const form = event.target as HTMLFormElement
    const passwordField = form.querySelector<HTMLInputElement>('input[type="password"]')
    if (!passwordField || !passwordField.value) return
    const usernameField = findUsernameField(passwordField)
    const username = usernameField?.value ?? ''
    const password = passwordField.value
    const origin = window.location.origin

    chrome.runtime.sendMessage(
      { type: 'LOGIN_FORM_SUBMITTED', origin, username, password },
      (response: { ok: boolean; data?: { shouldPrompt: boolean } }) => {
        if (response?.ok && response.data?.shouldPrompt) {
          showSavePrompt(origin, username, password)
        }
      },
    )
  },
  true, // capture phase — read the values before the page's own submit handler can clear the form
)

chrome.runtime.onMessage.addListener((message: { type: string; username?: string; password?: string }) => {
  if (message.type === 'FILL_CREDENTIALS' && message.password !== undefined) {
    fillCredentials(message.username ?? '', message.password)
  }
})
