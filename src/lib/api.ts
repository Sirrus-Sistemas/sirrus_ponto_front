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

// ─── Callback injetado por session.ts para reagendar o próximo refresh ────────
let onTokenRefreshedCallback: (() => void) | null = null

export function setOnTokenRefreshed(cb: () => void) {
  onTokenRefreshedCallback = cb
}

// ─── Fila de refresh: garante que múltiplas requisições 401 simultâneas
//     disparem apenas um único refresh, não vários em paralelo ─────────────────
let refreshPromise: Promise<boolean> | null = null

/**
 * Renova o access token usando o refresh token armazenado.
 * Usa fetch direto (não apiRequest) para evitar loop infinito de retry.
 * Retorna true se o refresh foi bem-sucedido.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken()
    const base = getApiBaseUrl()
    if (!refreshToken || !base) return false

    try {
      const res = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return false

      const data = (await res.json()) as {
        data?: { access_token?: string; refresh_token?: string }
      }
      const newAccess = data?.data?.access_token
      const newRefresh = data?.data?.refresh_token
      if (!newAccess) return false

      setStoredToken(newAccess)
      if (newRefresh) setStoredRefreshToken(newRefresh)

      onTokenRefreshedCallback?.()
      return true
    } catch {
      return false
    }
  })()

  const result = await refreshPromise
  refreshPromise = null
  return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export async function apiRequest<T>(path: string, options: RequestInit = {}, _retry = false): Promise<T> {
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
    // Primeira tentativa de 401: tenta renovar o token antes de deslogar
    if (res.status === 401 && token && !_retry) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return apiRequest<T>(path, options, true) // retry com novo token
      }
      clearStoredToken()
      window.location.assign('/')
      throw new ApiError('Sessão expirada. Redirecionando…', 401)
    }
    const msg = messageFromBody(data, res.statusText || 'Erro na requisição')
    throw new ApiError(msg, res.status, data)
  }

  return data as T
}
