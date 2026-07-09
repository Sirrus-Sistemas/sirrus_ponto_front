import { apiRequest } from '../lib/api'

export type MarcacaoFicha = {
  id: number
  data_hora: string
  tipo: string
  motivo_edicao: string | null
  original: number
}

export type DiaFicha = {
  data: string
  bloqueado?: boolean
  marcacoes: MarcacaoFicha[]
}

export type FichaFuncionario = {
  id: number
  nome: string
  matricula: string | null
}

export type FichaPayload = {
  funcionario: FichaFuncionario
  ano: number
  mes: number
  dias: DiaFicha[]
}

type FichaResponse = { success?: boolean; data: FichaPayload }
type MarcacaoResponse = { success?: boolean; data: { id: number; data_hora: string; tipo: string; motivo_edicao: string | null } }
type SimpleResponse = { success?: boolean; data: { id: number } }

export async function fetchFicha(
  ano: number,
  mes: number,
  funcionarioId?: number,
): Promise<FichaPayload> {
  const qs = new URLSearchParams({ ano: String(ano), mes: String(mes) })
  if (funcionarioId != null) qs.set('funcionario_id', String(funcionarioId))
  const res = await apiRequest<FichaResponse>(`/api/marcacoes/ficha?${qs.toString()}`)
  return res.data
}

export async function lancarBatida(payload: {
  funcionario_id: number
  data_hora: string
  motivo?: string
  justificativa?: string
  slot_override?: number | null
  dia_referencia?: string | null
}): Promise<{ id: number; data_hora: string; tipo: string; motivo_edicao: string | null }> {
  const res = await apiRequest<MarcacaoResponse>('/api/marcacoes/lancar', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function editarBatida(
  id: number,
  payload: {
    data_hora?: string
    motivo?: string
    justificativa?: string
    slot_override?: number | null
    dia_referencia?: string | null
  },
): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/marcacoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function excluirBatida(id: number): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/marcacoes/${id}`, { method: 'DELETE' })
}

export async function bloquearDia(payload: { funcionario_id: number; data: string }): Promise<void> {
  await apiRequest<{ success?: boolean }>('/api/marcacoes/bloquear-dia', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function desbloquearDia(funcionarioId: number, data: string): Promise<void> {
  await apiRequest<{ success?: boolean }>(`/api/marcacoes/bloquear-dia/${funcionarioId}/${data}`, {
    method: 'DELETE',
  })
}

export async function desbloquearPeriodo(payload: {
  data_inicio: string
  data_fim: string
  funcionario_ids?: number[]
}): Promise<{ removidos: number }> {
  const res = await apiRequest<{ success?: boolean; data: { removidos: number } }>(
    '/api/marcacoes/desbloquear-periodo',
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return res.data
}

export async function bloquearPeriodo(payload: {
  data_inicio: string
  data_fim: string
  funcionario_ids?: number[]
}): Promise<{ funcionarios: number; dias: number; total: number }> {
  const res = await apiRequest<{ success?: boolean; data: { funcionarios: number; dias: number; total: number } }>(
    '/api/marcacoes/bloquear-periodo',
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return res.data
}

export type Bloqueada = {
  id: number
  funcionario_id: number
  funcionario_nome: string
  data_hora: string
  tipo: string
  mobile_ref_id: number | null
  grupo_id: string
  motivo_bloqueio: string
  desbloqueado_por: number | null
  desbloqueado_em: string | null
}

export async function fetchBloqueadas(funcionarioId?: number): Promise<Bloqueada[]> {
  const qs = funcionarioId ? `?funcionario_id=${funcionarioId}` : ''
  const res = await apiRequest<{ success?: boolean; data: Bloqueada[] }>(`/api/mobile/bloqueadas${qs}`)
  return res.data
}

export async function desbloquearBloqueada(id: number): Promise<void> {
  await apiRequest(`/api/mobile/bloqueadas/${id}/desbloquear`, { method: 'POST' })
}
