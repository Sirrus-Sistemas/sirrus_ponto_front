import { apiRequest } from '../lib/api'

export type MarcacaoPendente = {
  id: number
  relogio_id: number
  relogio_descricao: string
  nsr: number
  cpf: string | null
  pis: string | null
  data_hora: string
  criado_em: string
}

type Envelope<T> = { success: boolean; data: T; message?: string }

export type PendentesPagina = {
  data: MarcacaoPendente[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export async function fetchMarcacoesPendentes(
  opts: { relogioId?: number; search?: string; page?: number; limit?: number } = {},
): Promise<PendentesPagina> {
  const params = new URLSearchParams()
  if (opts.relogioId) params.set('relogio_id', String(opts.relogioId))
  if (opts.search) params.set('search', opts.search)
  params.set('page', String(opts.page ?? 1))
  params.set('limit', String(opts.limit ?? 50))
  return apiRequest<PendentesPagina>(`/api/relogios/marcacoes/pendentes?${params.toString()}`)
}

export async function vincularMarcacaoPendente(id: number, funcionarioId: number): Promise<void> {
  await apiRequest(`/api/relogios/marcacoes/${id}/vincular`, {
    method: 'POST',
    body: JSON.stringify({ funcionario_id: funcionarioId }),
  })
}

/** Descarta uma marcação pendente sem vincular (ex.: batida de teste de funcionário fantasma). */
export async function excluirMarcacaoPendente(id: number): Promise<void> {
  await apiRequest(`/api/relogios/marcacoes/${id}`, { method: 'DELETE' })
}

export type ExcluirLoteResultado = { excluidas: number }

/** Mesma regra de excluirMarcacaoPendente, para várias de uma vez. */
export async function excluirMarcacoesPendentesEmLote(ids: number[]): Promise<ExcluirLoteResultado> {
  const res = await apiRequest<Envelope<ExcluirLoteResultado>>('/api/relogios/marcacoes/excluir-lote', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  return res.data
}

export type ValidarTodosResultado = { total: number; vinculadas: number }

/** Revalida todas as pendentes contra o cadastro atual — resolve o caso de CPF/PIS corrigido depois da importação. */
export async function validarTodasPendentes(): Promise<ValidarTodosResultado> {
  const res = await apiRequest<Envelope<ValidarTodosResultado>>('/api/relogios/marcacoes/validar-todos', {
    method: 'POST',
  })
  return res.data
}
