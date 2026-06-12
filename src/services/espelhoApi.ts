import { apiRequest } from '../lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusDia =
  | 'presente'
  | 'falta'
  | 'folga'
  | 'futuro'
  | 'sem_escala'
  | 'ocorrencia'

export type ModifierDia =
  | 'feriado'
  | 'incompleto'
  | 'escala_ausente'
  | 'sem_regime'
  | 'trabalho_em_folga'

export type MarcacaoEspelho = {
  id: number
  data_hora: string
  data_hora_local: string | null
  tipo: string
  tipo_label: string
  motivo_edicao: string | null
  original: number
  slot_override: number | null
}

export type FeriadoDia = {
  descricao: string
  tipo: string
}

export type OcorrenciaDia = {
  id: number
  tipo: string
  descricao: string | null
  tipo_ocorrencia_descricao: string | null
  tipo_lancamento: 'credito' | 'debito' | null
  turno: string | null
  quantidade_horas: number | null
}

export type DiaEspelho = {
  data: string
  dia_semana: number
  dia_semana_label: string
  status: StatusDia
  modifiers: ModifierDia[]
  dia_trabalho: boolean
  feriado: FeriadoDia | null
  ocorrencia: OcorrenciaDia | null
  marcacoes: MarcacaoEspelho[]
  /** Soma dos intervalos entre pares de batidas (1ª–2ª, 3ª–4ª, …). */
  minutos_trabalhados: number
  /** Meta da jornada em dias de trabalho; null em folga/feriado/futuro. */
  minutos_previstos: number | null
  /** trabalhadas − previsto (somente quando há previsto). */
  saldo_minutos: number | null
  /** Minutos a pagar a 100% conforme regra feriado/domingo da lotação. */
  extras_100pct_minutos: number
  /** Minutos de extras 50% (somente quando dividir_extras_50_100 está ativo na lotação). */
  extras_50pct_minutos: number
  /** Minutos em período noturno (lotação: hora_inicio_adicional_noturno até 05:00). */
  minutos_noturno: number
  /** Batida ímpar (intervalo aberto) ou ciclo incompleto. */
  incompleto: boolean
  /** Horários previstos do turno/escala para o dia (HH:MM), em hora local. */
  horarios_previstos: string[]
}

export type ResumoEspelho = {
  minutos_trabalhados_mes: number
  dias_com_marcacao: number
  dias_incompletos: number
  total_marcacoes: number
  /** Soma(dias de trabalho): trabalhadas − previsto; null sem turno definido. */
  saldo_mes_minutos: number | null
  dias_presentes: number
  dias_falta: number
  dias_folga: number
  dias_ocorrencia: number
  total_extras_100pct_minutos: number
  total_extras_50pct_minutos: number
  total_minutos_noturno: number
}

export type EspelhoMeta = {
  funcionario_id: number
  funcionario_nome: string | null
  funcionario_cargo: string | null
  funcionario_matricula: string | null
  funcionario_pis: string | null
  funcionario_cpf: string | null
  funcionario_data_admissao: string | null
  empresa_razao_social: string | null
  empresa_cnpj: string | null
  empresa_endereco: string | null
  empresa_cidade: string | null
  empresa_uf: string | null
  usa_escala: number
  turno_id: number | null
  turno_nome: string | null
  turno_horario: string | null
  minutos_previsto_dia_referencia: number | null
  dias_feriado_calendario: number
  /** Par 2–24; vem do turno do funcionário. */
  batidas_esperadas_dia?: number | null
  /** Offset de fuso horário do funcionário, ex: "-03:00". */
  tz_offset: string | null
}

export type EspelhoPayload = {
  ano: number
  mes: number
  meta: EspelhoMeta
  dias: DiaEspelho[]
  resumo: ResumoEspelho
}

type EspelhoResponse = {
  success?: boolean
  data: EspelhoPayload
}

export async function fetchEspelho(
  ano: number,
  mes: number,
  funcionarioId?: number,
  signal?: AbortSignal,
): Promise<EspelhoPayload> {
  const qs = new URLSearchParams({ ano: String(ano), mes: String(mes) })
  if (funcionarioId != null) qs.set('funcionario_id', String(funcionarioId))
  const res = await apiRequest<EspelhoResponse>(`/api/marcacoes/espelho?${qs.toString()}`, { signal })
  return res.data
}
