import styles from './Segmented.module.css'

interface SegmentedProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (val: string) => void
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div className={styles.track}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.option} ${o.value === value ? styles.active : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
