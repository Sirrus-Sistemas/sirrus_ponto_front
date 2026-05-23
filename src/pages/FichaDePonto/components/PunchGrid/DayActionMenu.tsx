import { useEffect, useRef } from 'react';
import type { DayRow } from '../../types';
import styles from './DayActionMenu.module.css';

export interface DayActionMenuContext {
  dayLabel: string;
  slotLabel: string;
  x: number;
  y: number;
  row: DayRow;
  funcionarioId: number;
  turnoId: number | null;
}

interface DayActionMenuProps {
  ctx: DayActionMenuContext;
  onClose: () => void;
  onAbonar: (ctx: DayActionMenuContext) => void;
  onLancarOcorrencia: (ctx: DayActionMenuContext) => void;
  onJustificativaAutomatica: (ctx: DayActionMenuContext) => void;
}

export function DayActionMenu({ ctx, onClose, onAbonar, onLancarOcorrencia, onJustificativaAutomatica }: DayActionMenuProps) {
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

  const menuWidth = 260;
  const menuHeight = 180;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = ctx.x + menuWidth > vw ? ctx.x - menuWidth : ctx.x;
  const top  = ctx.y + menuHeight > vh ? ctx.y - menuHeight : ctx.y;

  return (
    <div ref={ref} className={styles.menu} style={{ left, top }}>
      <div className={styles.header}>
        <span className={styles.headerDay}>{ctx.dayLabel}</span>
        <span className={styles.headerSep}>·</span>
        <span className={styles.headerSlot}>CÉLULA {ctx.slotLabel}</span>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Ocorrências</p>

        <button
          type="button"
          className={styles.item}
          onClick={() => { onClose(); onAbonar(ctx); }}
        >
          <span className={styles.itemLabel}>Abonar</span>
        </button>

        <button
          type="button"
          className={styles.item}
          onClick={() => { onClose(); onLancarOcorrencia(ctx); }}
        >
          <span className={styles.itemLabel}>Lançar Ocorrência por Período</span>
        </button>

        <button
          type="button"
          className={styles.item}
          onClick={() => { onClose(); onJustificativaAutomatica(ctx); }}
        >
          <span className={styles.itemLabel}>Justificativa Automática</span>
        </button>
      </div>
    </div>
  );
}
