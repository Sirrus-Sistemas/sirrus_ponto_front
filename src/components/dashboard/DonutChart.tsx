import styles from './DonutChart.module.css'

type DonutChartProps = {
  /** Texto no centro, ex.: "7h 12m" */
  label: string
  /** Parte principal do anel (0–100), ex.: 88 */
  greenPercent: number
  /** Faixa secundária após o verde (0–100 do restante visual), ex.: 12 */
  yellowPercent: number
}

export function DonutChart({ label, greenPercent, yellowPercent }: DonutChartProps) {
  const r = 40
  const c = 2 * Math.PI * r
  const g = Math.min(Math.max(greenPercent, 0), 100) / 100
  const y = Math.min(Math.max(yellowPercent, 0), 100) / 100
  const lenGreen = g * c
  const lenYellow = y * c
  const rotYellow = -90 + g * 360

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 100 100" className={styles.svg} aria-hidden>
        <circle
          className={styles.track}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="11"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#14918b"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${lenGreen} ${c}`}
          transform="rotate(-90 50 50)"
        />
        {lenYellow > 0 ? (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#d4a017"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${lenYellow} ${c}`}
            transform={`rotate(${rotYellow} 50 50)`}
          />
        ) : null}
      </svg>
      <div className={styles.center}>
        <span className={styles.centerText}>{label}</span>
      </div>
    </div>
  )
}
