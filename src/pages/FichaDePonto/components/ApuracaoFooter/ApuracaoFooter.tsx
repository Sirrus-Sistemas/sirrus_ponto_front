import type { MonthlySummary } from '../../types';
import styles from './ApuracaoFooter.module.css';

function formatMins(mins: number): string {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = mins < 0 ? '-' : '';
  return `${sign}${h}h${String(m).padStart(2, '0')}`;
}

interface ApuracaoFooterProps {
  summary: MonthlySummary;
}

export function ApuracaoFooter({ summary }: ApuracaoFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.block}>
        <span className={styles.label}>Carga</span>
        <span className={styles.value}>{formatMins(summary.carga)}</span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Trabalhadas</span>
        <span className={styles.value}>{formatMins(summary.trabalhadas)}</span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Extras 50%</span>
        <span className={`${styles.value} ${styles.positive}`}>{formatMins(summary.extras50)}</span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Extra 100%</span>
        <span className={`${styles.value} ${summary.extras100 > 0 ? styles.positive : ''}`}>
          {formatMins(summary.extras100)}
        </span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Débito</span>
        <span className={`${styles.value} ${summary.debito > 0 ? styles.danger : ''}`}>
          {formatMins(summary.debito)}
        </span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Noturno</span>
        <span className={styles.value}>{formatMins(summary.noturno)}</span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Banco</span>
        <span className={`${styles.value} ${summary.banco >= 0 ? styles.positive : styles.danger}`}>
          {formatMins(summary.banco)}
        </span>
      </div>
      <div className={styles.divider} />

      <div className={styles.block}>
        <span className={styles.label}>Faltas / Abonos</span>
        <span className={styles.value}>{summary.faltas} / {summary.abonos}</span>
      </div>
    </footer>
  );
}
