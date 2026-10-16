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
  feriado: { label: 'Feriado' },
};

interface DayStatusBadgeProps {
  status: DayStatus;
  modifiers?: string[];
  /** Nome(s) do tipo de ocorrência do dia — substitui o genérico "Abonado". */
  ocorrencias?: string[];
}

export function DayStatusBadge({ status, modifiers, ocorrencias }: DayStatusBadgeProps) {
  const cfg = CONFIG[status];
  const isFeriado = modifiers?.includes('feriado') ?? false;
  // Dia com ocorrência mostra o tipo (Atestado, Férias, Falta…) — "Abonado"
  // aparecia até para ocorrência de débito, que não abona nada.
  const nomesOcorrencia = status === 'abonado' && ocorrencias?.length ? ocorrencias.join(' / ') : null;
  const label = isFeriado ? 'Feriado' : (nomesOcorrencia ?? cfg.label);
  return (
    <span className={`${styles.badge} ${styles[status]}`} title={nomesOcorrencia ?? undefined}>
      {isFeriado ? <Star size={10} fill="currentColor" strokeWidth={0} /> : <span className={styles.dot} />}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
