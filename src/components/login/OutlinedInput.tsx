import { useId, type InputHTMLAttributes } from 'react'
import styles from './OutlinedInput.module.css'

type OutlinedInputProps = {
  label: string
  /** Borda primária sempre visível (ex.: campo em destaque no layout). */
  emphasized?: boolean
} & InputHTMLAttributes<HTMLInputElement>

export function OutlinedInput({
  label,
  emphasized,
  className,
  id,
  ...props
}: OutlinedInputProps) {
  const genId = useId()
  const inputId = id ?? genId

  return (
    <div
      className={`${styles.wrapper} ${emphasized ? styles.wrapperEmphasized : ''} ${className ?? ''}`}
    >
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className={styles.input} {...props} />
    </div>
  )
}
