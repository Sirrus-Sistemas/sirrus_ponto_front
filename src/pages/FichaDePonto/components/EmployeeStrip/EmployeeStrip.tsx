import { Avatar } from '../ui/Avatar';
import styles from './EmployeeStrip.module.css';
import type { Employee, FolhaStatus } from '../../types';

interface EmployeeStripProps {
  employee: Employee;
  folhaStatus: FolhaStatus;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

const STATUS_LABELS: Record<FolhaStatus, string> = {
  aberta: 'Aberta',
  calculada: 'Calculada',
  fechada: 'Fechada',
};

export function EmployeeStrip({ employee, folhaStatus, onPrev, onNext, currentIndex, totalCount }: EmployeeStripProps) {
  const showNav = onPrev !== undefined && onNext !== undefined;
  return (
    <div className={styles.strip}>
      {showNav && (
        <button
          className={styles.navBtn}
          onClick={onPrev}
          disabled={currentIndex === 0}
          title="Funcionário anterior"
        >
          ‹
        </button>
      )}
      <div className={styles.left}>
        <Avatar initials={employee.initials} size="lg" />
        <div className={styles.nameBlock}>
          <span className={styles.fullName}>{employee.fullName}</span>
          <span className={styles.subLine}>
            matrícula {employee.matricula} · NSR {employee.nsr}
          </span>
          {showNav && totalCount !== undefined && (
            <span className={styles.navCounter}>{(currentIndex ?? 0) + 1} / {totalCount}</span>
          )}
        </div>
      </div>

      <div className={styles.cols}>
        <div className={styles.col}>
          <span className={styles.colLabel}>Empresa</span>
          <span className={styles.colValue}>{employee.company}</span>
        </div>
        <div className={styles.col}>
          <span className={styles.colLabel}>Cargo</span>
          <span className={styles.colValue}>{employee.role}</span>
        </div>
        <div className={styles.col}>
          <span className={styles.colLabel}>Jornada</span>
          <span className={styles.colValue}>{employee.workdayDescription}</span>
        </div>
        <div className={styles.col}>
          <span className={styles.colLabel}>Horário-base</span>
          <span className={styles.colValueMono}>{employee.baseSchedule}</span>
        </div>
        {employee.lotacao && (
          <div className={styles.col}>
            <span className={styles.colLabel}>Lotação</span>
            <span className={styles.colValue}>{employee.lotacao}</span>
          </div>
        )}
      </div>

      <div className={styles.statusWrap}>
        <span className={styles.statusLabel}>Status da folha</span>
        <span className={`${styles.statusPill} ${styles[`status_${folhaStatus}`]}`}>
          <span className={styles.statusDot} />
          {STATUS_LABELS[folhaStatus]}
        </span>
      </div>
      {showNav && (
        <button
          className={styles.navBtn}
          onClick={onNext}
          disabled={totalCount !== undefined && currentIndex === totalCount - 1}
          title="Próximo funcionário"
        >
          ›
        </button>
      )}
    </div>
  );
}
