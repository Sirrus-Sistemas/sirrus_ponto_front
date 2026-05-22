import { Star } from 'lucide-react';
import type { DayStatus } from '../../types';
import styles from './DayStatusBadge.module.css';

const CONFIG: Record<DayStatus, { label: string; icon?: boolean }> = {
  ok: { label: 'Normal' },
  inconsistente: { label: 'Inconsistente' },
  falta: { label: 'Falta' },
  abonado: { label: 'Abonado' },
  justificado: { label: 'Justificado' },
  pendente: { label: 'Pendente' },
  feriado: { label: 'Feriado', icon: true },
  folga: { label: 'Folga' },
};

interface DayStatusBadgeProps {
  status: DayStatus;
}

export function DayStatusBadge({ status }: DayStatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {cfg.icon && <Star size={10} fill="currentColor" strokeWidth={0} />}
      {!cfg.icon && <span className={styles.dot} />}
      {cfg.label}
    </span>
  );
}
