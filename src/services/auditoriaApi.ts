import { apiRequest } from '../lib/api'

export type AuditoriaTabela = 'marcacoes' | 'marcacoes_dia_bloqueado' | 'escalas' | 'ocorrencias' | 'funcionarios' | 'marcacoes_mobile_aprovacao'
export type AuditoriaAcao = 'INSERT' | 'UPDATE' | 'DELETE'

export type AuditoriaRegistro = {
  id: number
  usuario_id: number | null
  usuario_nome: string
  acao: AuditoriaAcao
  tabela: string
  registro_id: string
  dados_anteriores: Record<string, unknown> | unknown[] | null
  dados_novos: Record<string, unknown> | unknown[] | null
  ip_address: string | null
  created_at: string
}

export type AuditoriaPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export type AuditoriaResponse = {
  data: AuditoriaRegistro[]
  pagination: AuditoriaPagination
}

export async function fetchAuditoria(params: {
  dataInicio: string
  dataFim: string
  tabela?: AuditoriaTabela
  acao?: AuditoriaAcao
  usuarioId?: number
  page?: number
  limit?: number
}): Promise<AuditoriaResponse> {
  const qs = new URLSearchParams({
    data_inicio: params.dataInicio,
    data_fim: params.dataFim,
  })
  if (params.tabela) qs.set('tabela', params.tabela)
  if (params.acao) qs.set('acao', params.acao)
  if (params.usuarioId) qs.set('usuario_id', String(params.usuarioId))
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))

  return apiRequest<AuditoriaResponse>(`/api/auditoria?${qs.toString()}`)
}
