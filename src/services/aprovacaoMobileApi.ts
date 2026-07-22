import { apiRequest } from '../lib/api'

export type MarcacaoPendente = {
  mobile_id: number
  funcionario_id: number
  funcionario_nome: string
  turno: string | null
  tipo: 'E' | 'S'
  observacao: string | null
  latitude: number | null
  longitude: number | null
  foto_url: string | null
  data_hora_utc: string
}

export type DecidirResult = {
  processados: number
  erros: { mobile_id: number; error: string }[]
}

export async function fetchPendentesAprovacao(params: {
  filialId: number
  dataInicio: string
  dataFim: string
  lotacaoId?: number
  funcionarioId?: number
}): Promise<MarcacaoPendente[]> {
  const qs = new URLSearchParams({
    filial_id: String(params.filialId),
    data_inicio: params.dataInicio,
    data_fim: params.dataFim,
  })
  if (params.lotacaoId) qs.set('lotacao_id', String(params.lotacaoId))
  if (params.funcionarioId) qs.set('funcionario_id', String(params.funcionarioId))
  const r = await apiRequest<{ data: MarcacaoPendente[] }>(`/api/mobile/aprovacao/pendentes?${qs.toString()}`)
  return r.data
}

export async function decidirMarcacoesMobile(
  itens: MarcacaoPendente[],
  status: 'C' | 'N',
): Promise<DecidirResult> {
  const r = await apiRequest<{ data: DecidirResult }>('/api/mobile/aprovacao/decidir', {
    method: 'POST',
    body: JSON.stringify({
      status,
      itens: itens.map((i) => ({
        mobile_id: i.mobile_id,
        funcionario_id: i.funcionario_id,
        data_hora_utc: i.data_hora_utc,
        observacao: i.observacao,
      })),
    }),
  })
  return r.data
}
