import { apiRequest } from '../lib/api'

export type TipoLancamento = 'credito' | 'debito'
export type TipoHora = '50pct' | '100pct'
export type OrigemLancamento = 'manual' | 'fechamento_mensal'

export type LancamentoBancoHoras = {
  id: number
  data: string
  mes_referencia: string
  tipo: TipoLancamento
  tipo_hora: TipoHora
  minutos: number
  saldo_anterior: number
  saldo_posterior: number
  descricao: string | null
  origem: OrigemLancamento
  created_at: string
  lancado_por_nome: string | null
}

export type SaldoBancoHoras = {
  funcionario_id: number
  funcionario_nome: string
  saldo_50pct_minutos: number
  saldo_100pct_minutos: number
  data: LancamentoBancoHoras[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export type LancarBancoHorasPayload = {
  funcionario_id: number
  data: string
  mes_referencia: string
  tipo: TipoLancamento
  tipo_hora: TipoHora
  minutos: number
  descricao?: string | null
}

export type FecharMesResultado = {
  mes_referencia: string
  lancamentos: {
    id: number
    tipo_hora: TipoHora
    tipo: TipoLancamento
    minutos: number
    saldo_anterior: number
    saldo_posterior: number
  }[]
}

export async function fetchBancoHoras(funcionarioId: number, params?: { page?: number; limit?: number }): Promise<SaldoBancoHoras> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const query = qs.toString() ? `?${qs}` : ''
  const r = await apiRequest<{ data: SaldoBancoHoras }>(`/api/banco-horas/${funcionarioId}${query}`)
  return r.data
}

export async function lancarBancoHoras(payload: LancarBancoHorasPayload): Promise<{ id: number; saldo_anterior: number; saldo_posterior: number }> {
  const r = await apiRequest<{ data: { id: number; saldo_anterior: number; saldo_posterior: number } }>('/api/banco-horas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return r.data
}

/** true se a empresa ainda não tem nenhum lançamento — habilita oferecer o import do sistema antigo. */
export async function fetchPodeImportarBancoHoras(): Promise<boolean> {
  const r = await apiRequest<{ data: { pode_importar: boolean } }>('/api/banco-horas/importar/status')
  return r.data.pode_importar
}

export async function excluirBancoHoras(id: number): Promise<void> {
  await apiRequest<unknown>(`/api/banco-horas/${id}`, { method: 'DELETE' })
}

export async function fecharMesBancoHoras(funcionarioId: number, ano: number, mes: number): Promise<FecharMesResultado> {
  const r = await apiRequest<{ data: FecharMesResultado }>('/api/banco-horas/fechar-mes', {
    method: 'POST',
    body: JSON.stringify({ funcionario_id: funcionarioId, ano, mes }),
  })
  return r.data
}
