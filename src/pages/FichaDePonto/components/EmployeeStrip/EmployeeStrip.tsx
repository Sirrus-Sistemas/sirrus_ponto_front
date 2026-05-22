import { Avatar } from '../ui/Avatar';
import styles from './EmployeeStrip.module.css';
import type { Employee, FolhaStatus } from '../../types';

interface EmployeeStripProps {
  employee: Employee;
  folhaStatus: FolhaStatus;
}

const STATUS_LABELS: Record<FolhaStatus, string> = {
  aberta: 'Aberta',
  calculada: 'Calculada',
  fechada: 'Fechada',
};

export function EmployeeStrip({ employee, folhaStatus }: EmployeeStripProps) {
  return (
    <div className={styles.strip}>
      <div className={styles.left}>
        <Avatar initials={employee.initials} size="lg" />
        <div className={styles.nameBlock}>
          <span className={styles.fullName}>{employee.fullName}</span>
          <span className={styles.subLine}>
            matrícula {employee.matricula} · NSR {employee.nsr}
          </span>
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
      </div>

      <div className={styles.statusWrap}>
        <span className={styles.statusLabel}>Status da folha</span>
        <span className={`${styles.statusPill} ${styles[`status_${folhaStatus}`]}`}>
          <span className={styles.statusDot} />
          {STATUS_LABELS[folhaStatus]}
        </span>
      </div>
    </div>
  );
}
