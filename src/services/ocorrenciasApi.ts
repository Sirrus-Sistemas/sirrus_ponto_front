import { apiRequest } from '../lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoLancamento = 'credito' | 'debito'

export type TipoOcorrencia = {
  id: number
  descricao: string
  tipo_lancamento: TipoLancamento
  ativo: number
}

export type TurnoOcorrencia = 'integral' | '1_periodo' | '2_periodo' | '3_periodo' | '4_periodo'
export type TipoHora = 'hora_50_60' | 'hora_100'

export type Ocorrencia = {
  id: number
  funcionario_id: number
  funcionario_nome: string
  data_inicio: string
  data_fim: string
  tipo: string
  tipo_ocorrencia_id: number | null
  tipo_ocorrencia_descricao: string | null
  tipo_lancamento: TipoLancamento | null
  turno: TurnoOcorrencia | null
  tipo_hora: TipoHora | null
  quantidade_horas: number | null
  descricao: string | null
}

export type OcorrenciaPayload = {
  funcionario_id: number
  data_inicio: string
  data_fim: string
  tipo_ocorrencia_id: number
  turno: TurnoOcorrencia
  tipo_hora: TipoHora
  quantidade_horas?: number | null
  descricao?: string | null
}

// ─── Tipos de Ocorrência ─────────────────────────────────────────────────────

export async function fetchTiposOcorrencia(): Promise<TipoOcorrencia[]> {
  const res = await apiRequest<{ data: TipoOcorrencia[] }>('/api/tipos-ocorrencia')
  return res.data
}

export async function createTipoOcorrencia(payload: {
  descricao: string
  tipo_lancamento: TipoLancamento
}): Promise<TipoOcorrencia> {
  const res = await apiRequest<{ data: TipoOcorrencia }>('/api/tipos-ocorrencia', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateTipoOcorrencia(
  id: number,
  payload: Partial<{ descricao: string; tipo_lancamento: TipoLancamento; ativo: number }>
): Promise<void> {
  await apiRequest(`/api/tipos-ocorrencia/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ─── Ocorrências ──────────────────────────────────────────────────────────────

export async function fetchOcorrencias(params?: {
  funcionario_id?: number
  ano?: number
  mes?: number
}): Promise<Ocorrencia[]> {
  const qs = new URLSearchParams()
  if (params?.funcionario_id) qs.set('funcionario_id', String(params.funcionario_id))
  if (params?.ano) qs.set('ano', String(params.ano))
  if (params?.mes) qs.set('mes', String(params.mes))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await apiRequest<{ data: Ocorrencia[] }>(`/api/ocorrencias${suffix}`)
  return res.data
}

export async function createOcorrencia(payload: OcorrenciaPayload): Promise<{ id: number }> {
  const res = await apiRequest<{ data: { id: number } }>('/api/ocorrencias', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateOcorrencia(
  id: number,
  payload: Partial<OcorrenciaPayload>
): Promise<void> {
  await apiRequest(`/api/ocorrencias/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteOcorrencia(id: number): Promise<void> {
  await apiRequest(`/api/ocorrencias/${id}`, { method: 'DELETE' })
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const TURNO_LABELS: Record<TurnoOcorrencia, string> = {
  integral:   'Integral',
  '1_periodo': '1º Período',
  '2_periodo': '2º Período',
  '3_periodo': '3º Período',
  '4_periodo': '4º Período',
}

export const TIPO_HORA_LABELS: Record<TipoHora, string> = {
  hora_50_60: 'HORA 50%/60%',
  hora_100:   'HORA 100%',
}
