import { ApiError, getApiBaseUrl, getStoredToken, refreshAccessToken } from '../lib/api'

export type ArquivoMte = 'afd' | 'afdt' | 'acjef' | 'aej'

export type FiltroMte = {
  filialId: number
  lotacaoId?: number
  inicio: string // YYYY-MM-DD
  fim: string
  assinar: boolean
}

/**
 * Baixa um arquivo do Ministério do Trabalho (.txt ou .p7s assinado) e dispara
 * o download no navegador. Devolve os avisos do servidor (ex.: funcionários
 * sem CPF que ficaram fora do AEJ).
 */
export async function baixarArquivoMte(arquivo: ArquivoMte, filtro: FiltroMte): Promise<string[]> {
  const qs = new URLSearchParams({
    filial_id: String(filtro.filialId),
    inicio: filtro.inicio,
    fim: filtro.fim,
    ...(filtro.lotacaoId ? { lotacao_id: String(filtro.lotacaoId) } : {}),
    ...(filtro.assinar ? { assinar: '1' } : {}),
  })
  const url = `${getApiBaseUrl()}/api/mte/${arquivo}?${qs}`
  // Resposta é arquivo (não JSON) — fetch direto em vez de apiRequest.
  const chamar = () => fetch(url, { headers: { Authorization: `Bearer ${getStoredToken() ?? ''}` } })
  let res = await chamar()
  if (res.status === 401 && (await refreshAccessToken())) res = await chamar()
  if (!res.ok) {
    let msg = 'Não foi possível gerar o arquivo.'
    try { msg = ((await res.json()) as { message?: string }).message ?? msg } catch { /* corpo não-JSON */ }
    throw new ApiError(msg, res.status)
  }

  const nome = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
    ?? `${arquivo.toUpperCase()}_${filtro.inicio}_${filtro.fim}.txt`
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nome
  link.click()
  URL.revokeObjectURL(link.href)

  const avisos = res.headers.get('X-Avisos')
  return avisos ? decodeURIComponent(avisos).split(' | ') : []
}
