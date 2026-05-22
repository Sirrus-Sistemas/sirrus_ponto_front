import type { ReactNode } from 'react'
import styles from './LoginCard.module.css'

type LoginCardProps = {
  children: ReactNode
}

export function LoginCard({ children }: LoginCardProps) {
  return <div className={styles.card}>{children}</div>
}
