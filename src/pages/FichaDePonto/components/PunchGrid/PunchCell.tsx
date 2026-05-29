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
  isDragging?: boolean;
  isDragOver?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export function PunchCell({
  punch, isMissing, onClick, onDoubleClick,
  isDragging, isDragOver, onPointerDown,
}: PunchCellProps) {

  if (isMissing) {
    return (
      <div
        className={[styles.cell, styles.missing, isDragOver ? styles.dragOver : ''].filter(Boolean).join(' ')}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <span className={styles.missingDot} style={{ pointerEvents: 'none' }} />
        <span style={{ pointerEvents: 'none' }}>faltando</span>
      </div>
    );
  }

  if (punch) {
    const dotClass = SOURCE_DOT_CLASS[punch.source] ?? styles.origin_manual;
    return (
      <div
        className={[
          styles.cell, styles.filled,
          punch.source === 'manual' ? styles.manual : '',
          isDragging ? styles.dragging : '',
        ].filter(Boolean).join(' ')}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        style={{ touchAction: 'none', userSelect: 'none' }}
      >
        <span className={`${styles.originDot} ${dotClass}`} style={{ pointerEvents: 'none' }} />
        <span className={styles.time} style={{ pointerEvents: 'none' }}>{punch.time}</span>
      </div>
    );
  }

  return (
    <div
      className={[styles.cell, styles.empty, isDragOver ? styles.dragOver : ''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <Plus size={13} className={styles.plusIcon} style={{ pointerEvents: 'none' }} />
    </div>
  );
}
