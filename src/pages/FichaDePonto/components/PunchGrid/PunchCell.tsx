import { Plus } from 'lucide-react';
import type { Punch } from '../../types';
import styles from './PunchCell.module.css';

const SOURCE_DOT_CLASS: Record<string, string> = {
  rep:    styles.origin_rep,
  mobile: styles.origin_mobile,
  geo:    styles.origin_mobile,
  online: styles.origin_mobile,
  manual: styles.origin_manual,
};

interface PunchCellProps {
  punch: Punch | null;
  isMissing?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export function PunchCell({ punch, isMissing, onClick, onDoubleClick }: PunchCellProps) {
  if (isMissing) {
    return (
      <div
        className={`${styles.cell} ${styles.missing}`}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <span className={styles.missingDot} />
        faltando
      </div>
    );
  }

  if (punch) {
    const dotClass = SOURCE_DOT_CLASS[punch.source] ?? styles.origin_manual;
    return (
      <div
        className={`${styles.cell} ${styles.filled} ${punch.source === 'manual' ? styles.manual : ''}`}
        onDoubleClick={onDoubleClick}
      >
        <span className={`${styles.originDot} ${dotClass}`} />
        <span className={styles.time}>{punch.time}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.cell} ${styles.empty}`}
      onClick={onClick}
    >
      <Plus size={13} className={styles.plusIcon} />
    </div>
  );
}
