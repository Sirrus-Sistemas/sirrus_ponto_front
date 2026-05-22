import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './DatePicker.module.css'

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

type Props = {
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
  id?: string
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  placeholder?: string
  className?: string
  error?: boolean
}

function parseIso(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function today0(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

export function DatePicker({ value, onChange, id, required, disabled, min, max, placeholder, className, error }: Props) {
  const today = today0()
  const selected = parseIso(value)

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Calcula posição fixed do popup com base no trigger
  function calcPopupPos() {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const popupH = 340 // altura aproximada do popup

    if (spaceBelow >= popupH || spaceBelow >= 200) {
      setPopupStyle({ top: rect.bottom + 4, left: rect.left })
    } else {
      setPopupStyle({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
    }
  }

  useEffect(() => {
    if (!open) return
    calcPopupPos()

    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inPopup = popupRef.current?.contains(target)
      if (!inContainer && !inPopup) setOpen(false)
    }
    function onScroll() { calcPopupPos() }

    document.addEventListener('mousedown', onOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    }
  }, [value])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  function emit(iso: string) {
    onChange({ target: { value: iso } } as React.ChangeEvent<HTMLInputElement>)
  }

  function selectDay(date: Date) {
    emit(toIso(date))
    setOpen(false)
  }

  function goToday() {
    emit(toIso(today))
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setOpen(false)
  }

  function clear() {
    emit('')
    setOpen(false)
  }

  function buildGrid(): Date[] {
    const first = new Date(viewYear, viewMonth, 1)
    const start = new Date(first)
    start.setDate(start.getDate() - start.getDay())
    const cells: Date[] = []
    const d = new Date(start)
    while (cells.length < 42) {
      cells.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return cells
  }

  const minDate = min ? parseIso(min) : null
  const maxDate = max ? parseIso(max) : null

  function isDisabledDay(d: Date) {
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  const cells = open ? buildGrid() : []

  const popup = open ? (
    <div ref={popupRef} className={styles.popup} style={{ position: 'fixed', zIndex: 9999, ...popupStyle }}>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="Mês anterior">‹</button>
        <span className={styles.monthLabel}>{MONTHS[viewMonth]} de {viewYear}</span>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="Próximo mês">›</button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((w, i) => <span key={i} className={styles.weekday}>{w}</span>)}
      </div>

      <div className={styles.grid}>
        {cells.map((cell, i) => {
          const otherMonth = cell.getMonth() !== viewMonth
          const isToday = cell.getTime() === today.getTime()
          const isSel = selected && cell.getTime() === selected.getTime()
          const dis = isDisabledDay(cell)
          return (
            <button
              key={i}
              type="button"
              disabled={dis}
              className={[
                styles.day,
                otherMonth ? styles.dayOther : '',
                isToday && !isSel ? styles.dayToday : '',
                isSel ? styles.daySelected : '',
                dis ? styles.dayDisabled : '',
              ].filter(Boolean).join(' ')}
              onClick={() => !dis && selectDay(cell)}
            >
              {cell.getDate()}
            </button>
          )
        })}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.footerBtn} onClick={clear}>Limpar</button>
        <button type="button" className={styles.footerBtnPrimary} onClick={goToday}>Hoje</button>
      </div>
    </div>
  ) : null

  return (
    <div ref={containerRef} className={`${styles.wrap} ${className ?? ''}`}>
      <div
        className={`${styles.inputDisplay} ${disabled ? styles.inputDisabled : ''} ${error ? styles.inputError : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !disabled && setOpen((o) => !o) } }}
      >
        <span className={value ? styles.inputValue : styles.inputPlaceholder}>
          {value ? formatDisplay(value) : (placeholder ?? 'dd/mm/aaaa')}
        </span>
        <svg className={styles.calIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="14" height="14" rx="2" />
          <path d="M7 2v4M13 2v4M3 9h14" />
        </svg>
      </div>

      <input type="hidden" id={id} value={value} required={required} />

      {createPortal(popup, document.body)}
    </div>
  )
}
