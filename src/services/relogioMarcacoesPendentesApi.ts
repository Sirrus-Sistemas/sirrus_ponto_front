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

export async function fetchMarcacoesPendentes(
  opts: { relogioId?: number; search?: string } = {},
): Promise<MarcacaoPendente[]> {
  const params = new URLSearchParams()
  if (opts.relogioId) params.set('relogio_id', String(opts.relogioId))
  if (opts.search) params.set('search', opts.search)
  const qs = params.toString()
  const res = await apiRequest<Envelope<MarcacaoPendente[]>>(
    `/api/relogios/marcacoes/pendentes${qs ? `?${qs}` : ''}`,
  )
  return res.data
}

export async function vincularMarcacaoPendente(id: number, funcionarioId: number): Promise<void> {
  await apiRequest(`/api/relogios/marcacoes/${id}/vincular`, {
    method: 'POST',
    body: JSON.stringify({ funcionario_id: funcionarioId }),
  })
}
