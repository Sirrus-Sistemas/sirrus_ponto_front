import { useEffect, useRef } from 'react';
import styles from './DayActionMenu.module.css';

export interface DayActionMenuContext {
  dayLabel: string;   // "07/10"
  slotLabel: string;  // "E1", "S2", etc.
  x: number;
  y: number;
}

interface DayActionMenuProps {
  ctx: DayActionMenuContext;
  onClose: () => void;
}

const OCORRENCIA_ITEMS = [
  { label: 'Abonar' },
  { label: 'Lançar Ocorrência por Período' },
  { label: 'Justificativa Automática' },
];

export function DayActionMenu({ ctx, onClose }: DayActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // Adjust position to avoid going off-screen
  const menuWidth = 260;
  const menuHeight = 180;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = ctx.x + menuWidth > vw ? ctx.x - menuWidth : ctx.x;
  const top  = ctx.y + menuHeight > vh ? ctx.y - menuHeight : ctx.y;

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ left, top }}
    >
      <div className={styles.header}>
        <span className={styles.headerDay}>{ctx.dayLabel}</span>
        <span className={styles.headerSep}>·</span>
        <span className={styles.headerSlot}>CÉLULA {ctx.slotLabel}</span>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Ocorrências</p>
        {OCORRENCIA_ITEMS.map((item) => (
          <button key={item.label} type="button" className={styles.item} onClick={onClose}>
            <span className={styles.itemLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
