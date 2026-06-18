import { useEffect, useRef, useState } from 'react'
import styles from './Combobox.module.css'

interface ComboboxProps {
  options: string[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Buscar cidade…',
  disabled = false,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  function calcPanelRect() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setPanelRect({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options

  const queryTrimmed = query.trim()
  const hasExact = options.some((o) => o.toLowerCase() === queryTrimmed.toLowerCase())
  const showCustom = queryTrimmed !== '' && !hasExact

  function handleFocus() {
    if (disabled) return
    calcPanelRect()
    setQuery('')
    setOpen(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!open) {
      calcPanelRect()
      setOpen(true)
    }
  }

  function select(val: string) {
    onChange(val)
    setQuery('')
    setOpen(false)
  }

  const displayValue = open ? query : value

  return (
    <div ref={containerRef} className={styles.wrap}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        className={`${styles.input} ${disabled ? styles.disabled : ''}`}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={disabled ? 'Selecione a UF primeiro' : placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && !disabled && panelRect && (
        <div
          className={styles.panel}
          style={{
            position: 'fixed',
            top: panelRect.top,
            left: panelRect.left,
            width: panelRect.width,
          }}
        >
          {showCustom && (
            <button
              type="button"
              className={`${styles.option} ${styles.optionCustom}`}
              onMouseDown={(e) => { e.preventDefault(); select(queryTrimmed) }}
            >
              + Usar "{queryTrimmed}"
            </button>
          )}
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              className={`${styles.option} ${o === value ? styles.optionActive : ''}`}
              onMouseDown={(e) => { e.preventDefault(); select(o) }}
            >
              {o}
            </button>
          ))}
          {filtered.length === 0 && !showCustom && (
            <div className={styles.empty}>Nenhuma cidade encontrada</div>
          )}
        </div>
      )}
    </div>
  )
}
