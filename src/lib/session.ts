/**
 * Gerencia a sessão ativa: renova o token proativamente antes de expirar
 * quando há atividade do usuário, e cancela a renovação após inatividade.
 *
 * Fluxo:
 *   startSession() → agenda timer para 2 min antes do exp do JWT
 *   timer dispara  → usuário ativo? renova : ignora (deixa expirar)
 *   renovação ok   → agenda próximo timer
 *   renovação falha → redireciona para login
 */

import { clearStoredToken, getStoredToken, refreshAccessToken, setOnTokenRefreshed } from './api'

const INACTIVITY_MS    = 30 * 60 * 1000  // 30 min sem atividade → não renova
const REFRESH_BEFORE_MS =  2 * 60 * 1000  // renova 2 min antes do token expirar

let lastActivity = Date.now()
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let listening = false

function recordActivity() {
  lastActivity = Date.now()
}

/** Lê o campo `exp` do payload JWT sem verificar a assinatura (isso é papel do servidor). */
function decodeExp(token: string): number | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)

  const token = getStoredToken()
  if (!token) return

  const expiresAt = decodeExp(token)
  if (!expiresAt) return

  const delay = Math.max(0, expiresAt - REFRESH_BEFORE_MS - Date.now())

  refreshTimer = setTimeout(async () => {
    if (Date.now() - lastActivity > INACTIVITY_MS) return // inativo — deixa expirar

    const ok = await refreshAccessToken()
    if (!ok) {
      clearStoredToken()
      window.location.assign('/')
    }
    // scheduleRefresh() será chamado via callback setOnTokenRefreshed após o refresh
  }, delay)
}

/**
 * Inicia o rastreamento de atividade e agenda a primeira renovação proativa.
 * Chamar após login bem-sucedido.
 */
export function startSession() {
  lastActivity = Date.now()

  if (!listening) {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => document.addEventListener(e, recordActivity, { passive: true }))
    listening = true
  }

  // Quando api.ts completar um refresh (reativo ou proativo), reagenda o próximo
  setOnTokenRefreshed(scheduleRefresh)
  scheduleRefresh()
}

/** Para o timer (ex.: logout explícito). */
export function stopSession() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}
