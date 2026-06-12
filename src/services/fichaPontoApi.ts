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
}): Promise<{ id: number; data_hora: string; tipo: string; motivo_edicao: string | null }> {
  const res = await apiRequest<MarcacaoResponse>('/api/marcacoes/lancar', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function editarBatida(
  id: number,
  payload: { data_hora: string; motivo?: string; justificativa?: string; slot_override?: number | null },
): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/marcacoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function excluirBatida(id: number): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/marcacoes/${id}`, { method: 'DELETE' })
}
