/**
 * Cliente HTTP para o backend. Configure `VITE_API_URL` no `.env` (ex.: http://localhost:3000).
 */

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  return (raw ?? '').replace(/\/$/, '')
}

const TOKEN_KEY = 'ponto_token'
const REFRESH_KEY = 'ponto_refresh_token'

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY)
}

export function setStoredRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_KEY, token)
}

/** Remove access e refresh token (ex.: logout ou novo login). */
export function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function messageFromBody(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message
    if (typeof m === 'string') return m
    if (Array.isArray(m)) return m.filter(Boolean).join(' ')
  }
  if (data && typeof data === 'object' && 'error' in data) {
    const e = (data as { error: unknown }).error
    if (typeof e === 'string') return e
  }
  return fallback
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl()
  if (!base) {
    throw new ApiError('Defina VITE_API_URL no arquivo .env na raiz do projeto.', 0)
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(options.headers)

  if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  const data = parseJsonSafe(text)

  if (!res.ok) {
    // Sessão inválida: evita ficar no app com token expirado (não aplica a login, que não envia Bearer)
    if (res.status === 401 && token) {
      clearStoredToken()
      window.location.assign('/')
    }
    const msg = messageFromBody(data, res.statusText || 'Erro na requisição')
    throw new ApiError(msg, res.status, data)
  }

  return data as T
}
