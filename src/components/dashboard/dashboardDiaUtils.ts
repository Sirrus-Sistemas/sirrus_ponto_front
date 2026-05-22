/** Data YYYY-MM-DD no fuso de São Paulo (alinhado ao calendário do espelho no Brasil). */
export function hojeIsoPtBr(ref = new Date()): string {
  return ref.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Ano e mês (1–12) no fuso de São Paulo. */
export function anoMesEspelhoPtBr(ref = new Date()): { ano: number; mes: number } {
  const s = hojeIsoPtBr(ref)
  const [y, m] = s.split('-').map(Number)
  return { ano: y, mes: m }
}

export function formatMinutosPt(m: number): string {
  const sign = m < 0 ? '-' : ''
  const abs = Math.abs(Math.round(m))
  const h = Math.floor(abs / 60)
  const min = abs % 60
  return `${sign}${h}h ${String(min).padStart(2, '0')}m`
}

export function formatMinutosPtAbs(m: number): string {
  return formatMinutosPt(Math.abs(Math.round(m)))
}

export function formatSaldoMesPt(minutos: number | null): string {
  if (minutos == null) return '—'
  if (minutos === 0) return '0h 00m'
  const sign = minutos > 0 ? '+' : ''
  return `${sign}${formatMinutosPtAbs(minutos)}`
}

/** TIME MySQL (`17:00:00`) → `17:00` */
export function horaTurnoParaRelogio(t: string | null | undefined): string | null {
  if (!t) return null
  const s = String(t).trim()
  return s.length >= 5 ? s.slice(0, 5) : null
}

const BATIDAS_PADRAO = 8

/** Número par de batidas/dia definido no turno (tabela de horários). */
export function normalizarBatidasEsperadas(b: number | null | undefined): number {
  const n = typeof b === 'number' && Number.isFinite(b) ? Math.floor(b) : parseInt(String(b ?? ''), 10)
  if (!Number.isFinite(n) || n < 2 || n > 24 || n % 2 !== 0) return BATIDAS_PADRAO
  return n
}

type PresetBatidas = { proxima: readonly string[]; ultima: readonly string[] }

const PRESETS_BATIDAS: Record<number, PresetBatidas> = {
  2: {
    proxima: ['Bater entrada', 'Bater saída'],
    ultima: ['Entrada', 'Saída'],
  },
  4: {
    proxima: [
      'Bater entrada',
      'Bater saída para intervalo',
      'Bater retorno do intervalo',
      'Bater saída',
    ],
    ultima: ['Entrada', 'Saída para intervalo', 'Retorno do intervalo', 'Saída'],
  },
  6: {
    proxima: [
      'Bater entrada',
      'Bater saída para intervalo',
      'Bater retorno do intervalo',
      'Bater saída (refeição)',
      'Bater entrada (tarde)',
      'Bater saída (expediente)',
    ],
    ultima: [
      'Entrada',
      'Saída para intervalo',
      'Retorno do intervalo',
      'Saída (refeição)',
      'Entrada (tarde)',
      'Saída (expediente)',
    ],
  },
  8: {
    proxima: [
      'Bater entrada (manhã)',
      'Bater saída para intervalo (manhã)',
      'Bater retorno do intervalo (manhã)',
      'Bater saída (refeição)',
      'Bater entrada (tarde)',
      'Bater saída para intervalo (tarde)',
      'Bater retorno do intervalo (tarde)',
      'Bater saída (expediente)',
    ],
    ultima: [
      'Entrada (manhã)',
      'Saída para intervalo (manhã)',
      'Retorno do intervalo (manhã)',
      'Saída (refeição)',
      'Entrada (tarde)',
      'Saída para intervalo (tarde)',
      'Retorno do intervalo (tarde)',
      'Saída (expediente)',
    ],
  },
}

function labelGenericaPar(idx: number, kind: 'proxima' | 'ultima'): string {
  const periodo = Math.floor(idx / 2) + 1
  const inicio = idx % 2 === 0
  if (kind === 'proxima') {
    return inicio ? `Bater início do período ${periodo}` : `Bater fim do período ${periodo}`
  }
  return inicio ? `Início do período ${periodo}` : `Fim do período ${periodo}`
}

function acaoLabelsPorIndice(idx: number, b: number, kind: 'proxima' | 'ultima'): string {
  const B = normalizarBatidasEsperadas(b)
  const safeIdx = ((idx % B) + B) % B
  const preset = PRESETS_BATIDAS[B]
  if (preset) {
    const arr = kind === 'proxima' ? preset.proxima : preset.ultima
    if (safeIdx >= 0 && safeIdx < arr.length) return arr[safeIdx]!
  }
  return labelGenericaPar(safeIdx, kind)
}

/** Próxima batida após `n` marcações, conforme `batidas_esperadas_dia` do turno. */
export function proximaAcaoLabel(n: number, batidasEsperadas: number | null | undefined): string {
  const b = normalizarBatidasEsperadas(batidasEsperadas)
  return acaoLabelsPorIndice(n % b, b, 'proxima')
}

/** Rótulo da última batida no ciclo do turno. */
export function ultimaBatidaTipoLabel(n: number, batidasEsperadas: number | null | undefined): string {
  if (n <= 0) return 'Nenhuma batida hoje'
  const b = normalizarBatidasEsperadas(batidasEsperadas)
  const lastIdx = (n - 1) % b
  return acaoLabelsPorIndice(lastIdx, b, 'ultima')
}

export type MetaLegenda = {
  texto: string
  tom: 'neutro' | 'alerta' | 'ok'
}

/** Texto coerente para “restante / saldo vs meta” (evita “Faltantes: -1h”). */
export function legendaVersusMeta(
  minutosPrevistos: number | null,
  saldoMinutos: number | null,
): MetaLegenda {
  if (minutosPrevistos == null) {
    return {
      texto: 'Sem meta de carga hoje (folga, feriado ou fim de semana)',
      tom: 'neutro',
    }
  }
  if (saldoMinutos == null) {
    return { texto: 'Sem dados de saldo', tom: 'neutro' }
  }
  if (saldoMinutos < 0) {
    return {
      texto: `Faltam ${formatMinutosPtAbs(saldoMinutos)} para a meta do dia`,
      tom: 'alerta',
    }
  }
  if (saldoMinutos > 0) {
    return {
      texto: `Acima da meta em ${formatMinutosPtAbs(saldoMinutos)}`,
      tom: 'ok',
    }
  }
  return { texto: 'Meta do dia cumprida', tom: 'ok' }
}

export function donutPercentsMeta(trabalhados: number, previsto: number | null): { green: number; yellow: number } {
  if (previsto == null || previsto <= 0) {
    return { green: trabalhados > 0 ? 100 : 0, yellow: 0 }
  }
  const green = Math.min(100, Math.round((trabalhados / previsto) * 100))
  return { green, yellow: Math.max(0, 100 - green) }
}

/**
 * Título do status: o backend já define `incompleto` (batida ímpar ou ciclo não fechado conforme batidas do turno).
 */
export function tituloStatusDia(d: {
  feriado: { descricao: string } | null
  dia_semana: number
  minutos_previstos: number | null
  marcacoes: unknown[]
  incompleto: boolean
}): string {
  if (d.feriado) return 'Feriado'
  if (d.dia_semana === 0 || d.dia_semana === 6) return 'Fim de semana'
  if (d.minutos_previstos == null) return 'Sem jornada prevista hoje'
  const n = d.marcacoes.length
  if (n === 0) return 'Aguardando entrada'
  if (d.incompleto) return 'Jornada em andamento'
  return 'Jornada concluída hoje'
}
