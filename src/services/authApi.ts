import {
  ApiError,
  apiRequest,
  clearStoredToken,
  setStoredRefreshToken,
  setStoredToken,
} from '../lib/api'

/** Ajuste estes caminhos para os mesmos do seu backend. */
const LOGIN_PATH = '/api/auth/login'
const LOGOUT_PATH = '/api/auth/logout'
const FORGOT_PASSWORD_PATH = '/api/auth/forgot-password'

export type LoginResponse = Record<string, unknown>

function pickToken(data: LoginResponse): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const o = data as Record<string, unknown>
  const fromRecord = (r: Record<string, unknown>): string | undefined => {
    const v =
      r.access_token ?? r.accessToken ?? r.token
    return typeof v === 'string' && v.length > 0 ? v : undefined
  }
  const direct = fromRecord(o)
  if (direct) return direct
  const inner = o.data
  if (inner && typeof inner === 'object' && inner !== null) {
    const t = fromRecord(inner as Record<string, unknown>)
    if (t) return t
    const nested = (inner as Record<string, unknown>).tokens
    if (nested && typeof nested === 'object' && nested !== null) {
      const u = fromRecord(nested as Record<string, unknown>)
      if (u) return u
    }
  }
  return undefined
}

function pickRefreshToken(data: LoginResponse): string | undefined {
  if (data.data && typeof data.data === 'object' && data.data !== null) {
    const inner = data.data as Record<string, unknown>
    const r = inner.refresh_token ?? inner.refreshToken
    if (typeof r === 'string') return r
  }
  return undefined
}

/**
 * Login com CPF (somente dígitos) e senha.
 * Ajuste o corpo em JSON se sua API usar outros nomes (ex.: `username`, `cpfComMascara`).
 */
export async function loginRequest(cpfDigits: string, password: string): Promise<LoginResponse> {
  clearStoredToken()
  const data = await apiRequest<LoginResponse>(LOGIN_PATH, {
    method: 'POST',
    body: JSON.stringify({ cpf: cpfDigits, password }),
  })
  const token = pickToken(data)
  if (!token) {
    throw new ApiError(
      'A API não retornou um token de acesso. Confira se o backend está atualizado e use o mesmo formato de resposta de /api/auth/login.',
      200,
      data,
    )
  }
  setStoredToken(token)
  const refresh = pickRefreshToken(data)
  if (refresh) {
    setStoredRefreshToken(refresh)
  }
  return data
}

export async function forgotPasswordRequest(cpfDigits: string): Promise<void> {
  await apiRequest(FORGOT_PASSWORD_PATH, {
    method: 'POST',
    body: JSON.stringify({ cpf: cpfDigits }),
  })
}

/** Revoga refresh tokens no servidor (Bearer obrigatório). */
export async function logoutRequest(): Promise<void> {
  await apiRequest(LOGOUT_PATH, { method: 'POST', body: '{}' })
}
