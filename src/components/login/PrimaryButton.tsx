import type { ButtonHTMLAttributes } from 'react'
import styles from './PrimaryButton.module.css'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function PrimaryButton({ className, type = 'submit', children, ...props }: PrimaryButtonProps) {
  return (
    <button type={type} className={`${styles.button} ${className ?? ''}`} {...props}>
      {children}
    </button>
  )
}
