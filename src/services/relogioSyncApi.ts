import { apiRequest } from '../lib/api'

export type FilaStatus = 'pendente' | 'enviado' | 'erro'
export type FilaOperacao = 'inserir' | 'atualizar' | 'excluir'

export type FilaItem = {
  id: number
  funcionario_id: number
  operacao: FilaOperacao
  status: FilaStatus
  tentativas: number
  erro_msg: string | null
  criado_em: string
  atualizado_em: string
  processado_em: string | null
  nome: string
  cpf: string
  pis: string | null
  cargo: string | null
  lotacao_nome: string | null
  departamento_nome: string | null
}

export type ContadorFila = {
  relogio_id: number
  total_pendente: number
  total_erro: number
}

type Envelope<T> = { success: boolean; data: T; message?: string }

export async function fetchFila(
  relogioId: number,
  opts: { status?: FilaStatus; search?: string } = {},
): Promise<FilaItem[]> {
  const params = new URLSearchParams({ relogio_id: String(relogioId) })
  if (opts.status) params.set('status', opts.status)
  if (opts.search) params.set('search', opts.search)
  const res = await apiRequest<Envelope<FilaItem[]>>(`/api/relogios/comunicacao?${params}`)
  return res.data
}

export async function fetchContadores(): Promise<ContadorFila[]> {
  const res = await apiRequest<Envelope<ContadorFila[]>>('/api/relogios/comunicacao/contadores')
  return res.data
}

export async function enqueueManual(
  relogioId: number,
  funcionarioId: number,
  operacao: FilaOperacao,
): Promise<void> {
  await apiRequest('/api/relogios/comunicacao/enqueue', {
    method: 'POST',
    body: JSON.stringify({ relogio_id: relogioId, funcionario_id: funcionarioId, operacao }),
  })
}

export async function retentarErros(relogioId: number): Promise<number> {
  const res = await apiRequest<Envelope<{ total: number }>>(
    `/api/relogios/comunicacao/retentar?relogio_id=${relogioId}`,
    { method: 'POST' },
  )
  return res.data.total
}

export async function removerDaFila(filaId: number, relogioId: number): Promise<void> {
  await apiRequest(`/api/relogios/comunicacao/${filaId}?relogio_id=${relogioId}`, {
    method: 'DELETE',
  })
}

export type RelogioSaudeItem = {
  id: number
  status: 'ok' | 'erro' | string
  erro?: string
}

export type SistemasSaude = {
  versao: string | null
  status: string | null
  ultimo_sync: string | null
  relogios: RelogioSaudeItem[]
  recebido_em: string
} | null

export async function fetchSaude(): Promise<SistemasSaude> {
  const res = await apiRequest<Envelope<SistemasSaude>>('/api/relogios/saude')
  return res.data
}
