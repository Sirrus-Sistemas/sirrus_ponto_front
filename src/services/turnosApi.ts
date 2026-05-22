import { apiRequest } from '../lib/api'

export type TurnoTipo = 'fixo' | 'flexivel' | 'escala'

export type Turno = {
  id: number
  empresa_id?: number
  nome: string
  entrada: string
  saida: string
  saida_intervalo?: string
  retorno_intervalo?: string
  tolerancia_atraso_min?: number
  tolerancia_extra_min?: number
  intervalo_minimo_min?: number
  carga_horaria_diaria?: string | null
  tipo?: TurnoTipo
  /** Par 2–24; ciclo diário esperado no espelho. */
  batidas_esperadas_dia?: number
  ativo?: number
  total_funcionarios?: number
}

type ListaResponse<T> = {
  success?: boolean
  data: T
}

/** Converte TIME do MySQL (`08:00:00`) para valor de `<input type="time" />`. */
export function horaParaInput(v: string | null | undefined): string {
  if (!v) return ''
  const s = String(v).trim()
  return s.length >= 5 ? s.slice(0, 5) : s
}

export async function fetchTurnos(): Promise<Turno[]> {
  const res = await apiRequest<ListaResponse<Turno[]>>('/api/turnos')
  return Array.isArray(res.data) ? res.data : []
}

export type CreateTurnoPayload = {
  nome: string
  entrada: string
  saida_intervalo: string
  retorno_intervalo: string
  saida: string
  tolerancia_atraso_min?: number
  tolerancia_extra_min?: number
  intervalo_minimo_min?: number
  tipo?: TurnoTipo
  batidas_esperadas_dia?: number
}

type CreateTurnoResponse = {
  success?: boolean
  data: Record<string, unknown>
}

export async function createTurno(payload: CreateTurnoPayload): Promise<Record<string, unknown>> {
  const body: CreateTurnoPayload = {
    nome: payload.nome,
    entrada: payload.entrada,
    saida_intervalo: payload.saida_intervalo,
    retorno_intervalo: payload.retorno_intervalo,
    saida: payload.saida,
    tolerancia_atraso_min: payload.tolerancia_atraso_min ?? 10,
    tolerancia_extra_min: payload.tolerancia_extra_min ?? 10,
    intervalo_minimo_min: payload.intervalo_minimo_min ?? 60,
    tipo: payload.tipo ?? 'fixo',
    batidas_esperadas_dia: payload.batidas_esperadas_dia ?? 8,
  }
  const res = await apiRequest<CreateTurnoResponse>('/api/turnos', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res.data
}

export type UpdateTurnoPayload = Partial<{
  nome: string
  entrada: string
  saida_intervalo: string
  retorno_intervalo: string
  saida: string
  tolerancia_atraso_min: number
  tolerancia_extra_min: number
  intervalo_minimo_min: number
  tipo: TurnoTipo
  ativo: number
  batidas_esperadas_dia: number
}>

export async function updateTurno(id: number, payload: UpdateTurnoPayload): Promise<void> {
  await apiRequest(`/api/turnos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ── Horários por dia da semana ────────────────────────────────────────────────

export type TurnoHorarioDia = {
  dia_semana: number       // 0=Dom … 6=Sáb
  trabalha: boolean
  entrada: string          // "HH:MM" ou ""
  saida_intervalo: string
  retorno_intervalo: string
  saida: string
  carga_minutos: number    // calculado pelo backend no save
}

type TurnoHorarioResponse = { success?: boolean; data: Array<{
  dia_semana: number
  trabalha: number
  entrada: string | null
  saida_intervalo: string | null
  retorno_intervalo: string | null
  saida: string | null
  carga_minutos: number
}> }

export async function fetchTurnoHorarios(turnoId: number): Promise<TurnoHorarioDia[]> {
  const res = await apiRequest<TurnoHorarioResponse>(`/api/turnos/${turnoId}/horarios`)
  return (res.data ?? []).map((r) => ({
    dia_semana: r.dia_semana,
    trabalha: Boolean(r.trabalha),
    entrada: horaParaInput(r.entrada),
    saida_intervalo: horaParaInput(r.saida_intervalo),
    retorno_intervalo: horaParaInput(r.retorno_intervalo),
    saida: horaParaInput(r.saida),
    carga_minutos: r.carga_minutos ?? 0,
  }))
}

export async function saveTurnoHorarios(turnoId: number, dias: TurnoHorarioDia[]): Promise<void> {
  const body = dias.map((d) => ({
    dia_semana: d.dia_semana,
    trabalha: d.trabalha ? 1 : 0,
    entrada: d.trabalha ? d.entrada || null : null,
    saida_intervalo: d.trabalha ? d.saida_intervalo || null : null,
    retorno_intervalo: d.trabalha ? d.retorno_intervalo || null : null,
    saida: d.trabalha ? d.saida || null : null,
  }))
  await apiRequest(`/api/turnos/${turnoId}/horarios`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** Calcula carga em minutos a partir dos horários (client-side, só para exibição) */
export function calcCargaDisplay(d: TurnoHorarioDia): string {
  if (!d.trabalha) return 'Folga'
  if (!d.entrada || !d.saida) return '—'
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  let min: number
  if (d.saida_intervalo && d.retorno_intervalo) {
    min = Math.max(0, (toMin(d.saida_intervalo) - toMin(d.entrada)) + (toMin(d.saida) - toMin(d.retorno_intervalo)))
  } else {
    min = Math.max(0, toMin(d.saida) - toMin(d.entrada))
  }
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`
}
