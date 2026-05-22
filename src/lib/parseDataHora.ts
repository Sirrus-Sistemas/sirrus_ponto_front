/**
 * Converte `data_hora` da API para `Date` correto.
 * Se vier string MySQL sem fuso ("YYYY-MM-DD HH:mm:ss"), assume UTC (mesmo contrato do backend).
 */
export function parseDataHoraUtc(input: string | Date): Date {
  if (input instanceof Date) return input
  if (typeof input !== 'string') return new Date(input as string)

  if (input.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(input)) {
    return new Date(input)
  }

  const m = input.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  if (m) {
    const frac = input.match(/\.(\d{1,6})/)
    const sub = frac ? `.${frac[1].padEnd(3, '0').slice(0, 3)}` : '.000'
    return new Date(`${m[1]}T${m[2]}${sub}Z`)
  }

  return new Date(input)
}

export function formatHoraLocalPtBr(input: string | Date): string {
  return parseDataHoraUtc(input).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
