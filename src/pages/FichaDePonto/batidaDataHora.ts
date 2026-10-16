/**
 * Data/hora de uma batida lançada na linha de um dia da Ficha de Ponto.
 *
 * A batida pertence ao dia de referência da linha. Só vai para o dia
 * seguinte quando a jornada passa da meia-noite — ou seja, quando o horário
 * "volta" em relação à batida anterior da sequência (ex.: entrada 22:00 →
 * saída 02:00). Antes, qualquer horário < 06:00 era gravado no dia ANTERIOR:
 * a saída da madrugada ficava antes da própria entrada e quem entra cedo
 * (05:30) caía no dia errado.
 */

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Quantos dias depois do dia de referência cai `horario`, dado o que vem
 * antes dele na jornada (`anteriores`, em ordem: E1, S1, E2…; vazios são
 * ignorados). Cada vez que um horário é menor que o anterior, cruzou a
 * meia-noite.
 */
export function diasAposReferencia(anteriores: (string | null | undefined)[], horario: string): number {
  const seq = [...anteriores.filter((t): t is string => !!t), horario].map(toMin)
  let dias = 0
  for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) dias++
  return dias
}

/**
 * Monta `data_hora` (UTC, "YYYY-MM-DD HH:MM:SS") e `dia_referencia` de uma
 * batida. `tzOffset` é o fuso do funcionário vindo do espelho (ex.: "-04:00")
 * — sem ele não dá pra saber a hora real, então lança erro em vez de chutar
 * um fuso padrão (o −03:00 fixo gravava 1h errado para quem está em −04:00).
 */
export function montarBatida(
  dia: { year: number; month: number; day: number },
  horario: string,
  diasAMais: number,
  tzOffset: string | null | undefined,
): { dataHoraUtc: string; diaRef: string } {
  if (!tzOffset) {
    throw new Error('Fuso horário do funcionário não informado. Confira o município no cadastro do funcionário ou da empresa.')
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const data = new Date(dia.year, dia.month - 1, dia.day + diasAMais)
  const datePrefix = `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`
  const full = horario.length === 5 ? `${horario}:00` : horario
  const dataHoraUtc = new Date(`${datePrefix}T${full}${tzOffset}`).toISOString().replace('T', ' ').slice(0, 19)
  const diaRef = `${dia.year}-${pad(dia.month)}-${pad(dia.day)}`
  return { dataHoraUtc, diaRef }
}

/**
 * Minutos desde a meia-noite do dia de referência para uma sequência de
 * horários da jornada, em ordem — cada vez que o horário "volta", passou da
 * meia-noite e soma 24h (22:00, 02:00 → 1320, 1560). Mesma regra do backend
 * (utils/jornada.js).
 */
export function minutosDaJornada(horarios: string[]): number[] {
  let dias = 0
  let anterior: number | null = null
  return horarios.map((h) => {
    const min = toMin(h)
    if (anterior !== null && min < anterior) dias += 1
    anterior = min
    return dias * 1440 + min
  })
}

/**
 * Índices dos horários previstos sem batida real correspondente: cada batida
 * (em ordem) é casada com o previsto mais próximo (em ordem), com a menor
 * distância total. Faltando o almoço (08:00, 14:00, 18:00 contra 08/12/14/18),
 * o que sobra é o 12:00 — não um segundo 18:00. Mesmo algoritmo do backend.
 */
export function previstosSemBatida(previstos: number[], existentes: number[]): number[] {
  const n = previstos.length
  const m = existentes.length
  if (m >= n) return []
  const INF = Number.POSITIVE_INFINITY
  const custo = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF))
  custo[0][0] = 0
  for (let i = 1; i <= n; i++) {
    custo[i][0] = 0
    for (let j = 1; j <= Math.min(i, m); j++) {
      custo[i][j] = Math.min(custo[i - 1][j], custo[i - 1][j - 1] + Math.abs(previstos[i - 1] - existentes[j - 1]))
    }
  }
  const faltantes: number[] = []
  let j = m
  for (let i = n; i >= 1; i--) {
    const casa = j > 0 ? custo[i - 1][j - 1] + Math.abs(previstos[i - 1] - existentes[j - 1]) : INF
    if (j > 0 && custo[i][j] === casa) j -= 1
    else faltantes.push(i - 1)
  }
  return faltantes.reverse()
}
