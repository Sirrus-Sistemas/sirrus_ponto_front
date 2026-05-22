import type { DiaEscala } from '../../services/escalasApi'
import { isFeriado, toLocalDate, MONTH_NAMES } from './escalaUtils'
import styles from './MiniCalendar.module.css'

const WEEKDAY_HEADERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface Props {
  preview: DiaEscala[] | null
  dataInicio: string
  dataFim: string
}

type DayVariant = 'work' | 'off' | 'holiday' | 'outside' | 'pending'

function getDayClass(variant: DayVariant, css: typeof styles): string {
  switch (variant) {
    case 'work':    return css.cellWork
    case 'off':     return css.cellOff
    case 'holiday': return css.cellHoliday
    case 'pending': return css.cellPending
    default:        return css.cellOutside
  }
}

export function MiniCalendar({ preview, dataInicio, dataFim }: Props) {
  const refDate = dataInicio ? toLocalDate(dataInicio) : new Date()
  const year = refDate.getFullYear()
  const month = refDate.getMonth()

  const previewMap = new Map<string, DiaEscala>()
  preview?.forEach((d) => previewMap.set(d.data, d))

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (string | null)[] = Array(firstDayOfWeek).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    )
  }

  function getVariant(iso: string): DayVariant {
    const inPeriod = dataInicio && dataFim && iso >= dataInicio && iso <= dataFim
    if (!inPeriod) return 'outside'
    if (isFeriado(iso)) return 'holiday'
    const d = previewMap.get(iso)
    if (!d) return 'pending'
    return d.tipo === 'trabalho' ? 'work' : 'off'
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <span className={styles.monthName}>{MONTH_NAMES[month]} {year}</span>
        <span className={styles.calTag}>Calendário</span>
      </div>
      <div className={styles.grid}>
        {WEEKDAY_HEADERS.map((w, i) => (
          <div key={i} className={styles.weekday}>{w}</div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className={styles.cellEmpty} />
          const variant = getVariant(iso)
          const day = parseInt(iso.split('-')[2], 10)
          return (
            <div key={i} className={`${styles.cell} ${getDayClass(variant, styles)}`}>
              {day}
            </div>
          )
        })}
      </div>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotWork}`} />
          <span>Trabalho</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotOff}`} />
          <span>Folga</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotHoliday}`} />
          <span>Feriado</span>
        </div>
      </div>
    </div>
  )
}
