import { apiRequest } from '../lib/api'
import { horaParaInput } from './turnosApi'

export { horaParaInput }

export type DomingoTipo = 'nao_calcular' | '50pct' | '100pct_extra' | '100pct_total'
export type FeriadoTipo = 'nao_calcular' | '50pct' | '100pct_extra' | '100pct_total'
export type DomingoNaoPrevistoTipo = 'nao_calcular' | '50pct' | '100pct_total' | 'igual_feriado'
export type DiaNaoPrevistoTipo = 'nao_calcular' | '50pct' | '100pct_total' | 'igual_domingo'
export type TipoExtra = '50_clt' | '60' | '80' | '100'

export type Lotacao = {
  id: number
  empresa_id?: number
  nome: string
  tipo_extra: TipoExtra
  calcular_extras_escalonado: number
  domingo_tipo: DomingoTipo
  feriado_tipo: FeriadoTipo
  domingo_nao_previsto_tipo: DomingoNaoPrevistoTipo
  dia_nao_previsto_tipo: DiaNaoPrevistoTipo
  somar_esq_horas_trabalhadas: number
  converter_falta_banco_horas: number
  lancar_100pct_banco_horas: number
  converter_falta_folha_ponto: number
  nao_gerar_debitos_meia_falta: number
  banco_horas_somente_dom_feriado: number
  dividir_extras_50_100: number
  calcular_60pct_sabados: number
  sabado_somente_extras: number
  juntar_100pct_sabado_normal: number
  atribuir_100pct_terceiro_domingo: number
  lancar_debitos_domingo_50pct: number
  tabela_zerada_e_folga: number
  hora_inicio_100pct: string | null
  hora_inicio_adicional_noturno: string
  ativo?: number
  total_funcionarios?: number
}

type ListaResponse<T> = { success?: boolean; data: T }

export async function fetchLotacoes(signal?: AbortSignal): Promise<Lotacao[]> {
  const res = await apiRequest<ListaResponse<Lotacao[]>>('/api/lotacoes', { signal })
  return Array.isArray(res.data) ? res.data : []
}

export type LotacaoPayload = Omit<Lotacao, 'id' | 'empresa_id' | 'ativo' | 'total_funcionarios'>

export async function createLotacao(payload: LotacaoPayload): Promise<Record<string, unknown>> {
  const res = await apiRequest<ListaResponse<Record<string, unknown>>>('/api/lotacoes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export type UpdateLotacaoPayload = Partial<LotacaoPayload & { ativo: number }>

export async function updateLotacao(id: number, payload: UpdateLotacaoPayload): Promise<void> {
  await apiRequest(`/api/lotacoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
