export const FERIADOS_BR = new Set([
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25',
])

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso: string): string {
  const d = toLocalDate(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function diaSemana(iso: string): string {
  return DIAS_SEMANA[toLocalDate(iso).getDay()]
}

export function isFeriado(iso: string): boolean {
  const parts = iso.split('-')
  return FERIADOS_BR.has(`${parts[1]}-${parts[2]}`)
}

export function parseTimeToMin(t: string | null): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function calcTotalHours(dias: {
  tipo: string
  entrada1: string | null; saida1: string | null
  entrada2: string | null; saida2: string | null
  entrada3: string | null; saida3: string | null
  entrada4: string | null; saida4: string | null
}[]): number {
  let mins = 0
  for (const dia of dias) {
    if (dia.tipo !== 'trabalho') continue
    const pairs: [string | null, string | null][] = [
      [dia.entrada1, dia.saida1],
      [dia.entrada2, dia.saida2],
      [dia.entrada3, dia.saida3],
      [dia.entrada4, dia.saida4],
    ]
    for (const [e, s] of pairs) {
      if (e && s) {
        let diff = parseTimeToMin(s) - parseTimeToMin(e)
        if (diff < 0) diff += 24 * 60
        mins += diff
      }
    }
  }
  return Math.round(mins / 60)
}

export function feriadosNoPeriodo(dataInicio: string, dataFim: string): string[] {
  if (!dataInicio || !dataFim || dataInicio > dataFim) return []
  const result: string[] = []
  const cur = toLocalDate(dataInicio)
  const end = toLocalDate(dataFim)
  while (cur <= end) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    if (isFeriado(iso)) result.push(iso)
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

export function inicioCicloHint(iso: string): string {
  if (!iso) return ''
  const d = toLocalDate(iso)
  return `${formatDate(iso)} (${DIAS_SEMANA[d.getDay()]})`
}
