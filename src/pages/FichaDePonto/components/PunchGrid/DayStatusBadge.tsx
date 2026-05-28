import { Star } from 'lucide-react';
import type { DayStatus } from '../../types';
import styles from './DayStatusBadge.module.css';

const CONFIG: Record<DayStatus, { label: string }> = {
  ok: { label: 'Normal' },
  inconsistente: { label: 'Inconsistente' },
  falta: { label: 'Falta' },
  abonado: { label: 'Abonado' },
  justificado: { label: 'Justificado' },
  pendente: { label: 'Pendente' },
  folga: { label: 'Folga' },
};

interface DayStatusBadgeProps {
  status: DayStatus;
  modifiers?: string[];
}

export function DayStatusBadge({ status, modifiers }: DayStatusBadgeProps) {
  const cfg = CONFIG[status];
  const isFeriado = modifiers?.includes('feriado') ?? false;
  const label = isFeriado ? 'Feriado' : cfg.label;
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {isFeriado ? <Star size={10} fill="currentColor" strokeWidth={0} /> : <span className={styles.dot} />}
      {label}
    </span>
  );
}
