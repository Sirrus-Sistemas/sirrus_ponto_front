import { apiRequest, getApiBaseUrl, getStoredToken, refreshAccessToken, ApiError } from '../lib/api'
import type { TurnoOcorrencia, TipoHora } from './ocorrenciasApi'

export type OcorrenciaPendente = {
  mobile_id: number
  funcionario_id: number
  funcionario_nome: string
  data_inicio: string // YYYY-MM-DD
  data_fim: string
  turno: TurnoOcorrencia
  motivo_label: string | null
  justificativa: string | null
  horas_app: number | null
  tem_anexo: boolean
  criada_em: string | null
}

export async function fetchOcorrenciasPendentesMobile(params: {
  filialId: number
  lotacaoId?: number
  funcionarioId?: number
}): Promise<OcorrenciaPendente[]> {
  const qs = new URLSearchParams({ filial_id: String(params.filialId) })
  if (params.lotacaoId) qs.set('lotacao_id', String(params.lotacaoId))
  if (params.funcionarioId) qs.set('funcionario_id', String(params.funcionarioId))
  const r = await apiRequest<{ data: OcorrenciaPendente[] }>(`/api/mobile/ocorrencias/pendentes?${qs.toString()}`)
  return r.data
}

export type AprovarOcorrenciaMobilePayload = {
  funcionario_id: number
  data_inicio: string
  data_fim: string
  tipo_ocorrencia_id: number
  turno: TurnoOcorrencia
  tipo_hora: TipoHora
  quantidade_horas?: number | null
  informativa?: number
  descricao?: string | null
}

export async function aprovarOcorrenciaMobile(mobileId: number, payload: AprovarOcorrenciaMobilePayload): Promise<{ ocorrenciaId: number }> {
  const r = await apiRequest<{ data: { ocorrenciaId: number } }>(`/api/mobile/ocorrencias/${mobileId}/aprovar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return r.data
}

export async function negarOcorrenciaMobile(mobileId: number): Promise<void> {
  await apiRequest(`/api/mobile/ocorrencias/${mobileId}/negar`, { method: 'POST' })
}

/**
 * Abre o anexo da ocorrência (foto/PDF) numa nova aba. O arquivo fica no disco
 * privado da API do Ponto Mobile — precisa passar pelo nosso backend
 * autenticado (fetch direto, não apiRequest: resposta é binária, não JSON).
 */
export async function abrirAnexoOcorrenciaMobile(mobileId: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/mobile/ocorrencias/${mobileId}/anexo`
  const chamar = () => fetch(url, { headers: { Authorization: `Bearer ${getStoredToken() ?? ''}` } })
  let res = await chamar()
  if (res.status === 401 && (await refreshAccessToken())) res = await chamar()
  if (!res.ok) {
    let msg = 'Não foi possível abrir o anexo.'
    try { msg = ((await res.json()) as { message?: string }).message ?? msg } catch { /* corpo não-JSON */ }
    throw new ApiError(msg, res.status)
  }
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
