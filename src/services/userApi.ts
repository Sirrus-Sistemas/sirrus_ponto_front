import { apiRequest } from '../lib/api'

export type FuncionarioMe = {
  id: number
  nome: string
  email: string
  foto_path?: string | null
  cargo?: string | null
  departamento_id?: number | null
  turno_id?: number | null
  role?: string
  departamento_nome?: string | null
  turno_nome?: string | null
  /** TIME do MySQL, ex. `08:00:00` */
  turno_entrada?: string | null
  turno_saida?: string | null
  turno_saida_intervalo?: string | null
  turno_retorno_intervalo?: string | null
  /** Par 2–24; vem do turno (tabela de horários). */
  turno_batidas_esperadas_dia?: number | null
}

type MeResponse = {
  success?: boolean
  data: FuncionarioMe
}

export async function fetchMe(): Promise<FuncionarioMe> {
  const res = await apiRequest<MeResponse>('/api/funcionarios/me')
  return res.data
}
