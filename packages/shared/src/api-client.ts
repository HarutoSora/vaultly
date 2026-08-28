// Relative by default — the web app assumes it's served from the same
// origin as the API (reverse-proxied under one domain in production, or
// Vite's dev proxy locally) so no CORS is needed at all for the common case.
// The browser extension has no such origin to share, so it calls
// setApiBaseUrl() once at startup with the API's real absolute origin.
let base = '/api'

export function setApiBaseUrl(url: string): void {
  base = url.replace(/\/$/, '')
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include', // the session cookie is HttpOnly — this is the only way it travels
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`
    try {
      const problem = (await res.json()) as { title?: string }
      if (problem.title) message = problem.title
    } catch {
      // no JSON body — keep the generic message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
