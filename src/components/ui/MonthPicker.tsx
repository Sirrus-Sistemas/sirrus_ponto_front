import { useEffect, useRef, useState } from 'react'
import styles from './DatePicker.module.css'
import mpStyles from './MonthPicker.module.css'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_LONG  = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

type Props = {
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
  id?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

function formatDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m] = iso.split('-')
  if (!y || !m) return iso
  const idx = parseInt(m, 10) - 1
  return `${MONTHS_LONG[idx] ?? m} de ${y}`
}

function today0(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

export function MonthPicker({ value, onChange, id, required, disabled, placeholder }: Props) {
  const today = today0()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0], 10)
    return today.getFullYear()
  })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  useEffect(() => {
    if (value) setViewYear(parseInt(value.split('-')[0], 10))
  }, [value])

  function emit(iso: string) {
    onChange({ target: { value: iso } } as React.ChangeEvent<HTMLInputElement>)
  }

  function selectMonth(monthIdx: number) {
    const m = String(monthIdx + 1).padStart(2, '0')
    emit(`${viewYear}-${m}`)
    setOpen(false)
  }

  function clear() {
    emit('')
    setOpen(false)
  }

  function thisMonth() {
    const m = String(today.getMonth() + 1).padStart(2, '0')
    emit(`${today.getFullYear()}-${m}`)
    setViewYear(today.getFullYear())
    setOpen(false)
  }

  const selYear = value ? parseInt(value.split('-')[0], 10) : null
  const selMonth = value ? parseInt(value.split('-')[1], 10) - 1 : null
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()

  return (
    <div ref={containerRef} className={styles.wrap}>
      <div
        className={`${styles.inputDisplay} ${disabled ? styles.inputDisabled : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !disabled && setOpen((o) => !o) } }}
      >
        <span className={value ? styles.inputValue : styles.inputPlaceholder}>
          {value ? formatDisplay(value) : (placeholder ?? 'mês / ano')}
        </span>
        <svg className={styles.calIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="14" height="14" rx="2" />
          <path d="M7 2v4M13 2v4M3 9h14" />
        </svg>
      </div>

      <input type="hidden" id={id} value={value} required={required} />

      {open && (
        <div className={styles.popup}>
          <div className={styles.header}>
            <button type="button" className={styles.navBtn} onClick={() => setViewYear((y) => y - 1)} aria-label="Ano anterior">‹</button>
            <span className={styles.monthLabel}>{viewYear}</span>
            <button type="button" className={styles.navBtn} onClick={() => setViewYear((y) => y + 1)} aria-label="Próximo ano">›</button>
          </div>

          <div className={mpStyles.monthGrid}>
            {MONTHS_SHORT.map((name, idx) => {
              const isSel = selYear === viewYear && selMonth === idx
              const isThisMonth = todayYear === viewYear && todayMonth === idx

              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    mpStyles.monthBtn,
                    isThisMonth && !isSel ? mpStyles.monthToday : '',
                    isSel ? mpStyles.monthSelected : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectMonth(idx)}
                >
                  {name}
                </button>
              )
            })}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.footerBtn} onClick={clear}>Limpar</button>
            <button type="button" className={styles.footerBtnPrimary} onClick={thisMonth}>Este mês</button>
          </div>
        </div>
      )}
    </div>
  )
}
