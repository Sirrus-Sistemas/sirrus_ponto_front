import { useState, useCallback } from 'react';
import { PanelRightOpen } from 'lucide-react';
import type { DayRow } from '../../types';
import { PunchRow } from './PunchRow';
import { DayActionMenu, type DayActionMenuContext } from './DayActionMenu';
import styles from './PunchGrid.module.css';

interface PunchGridProps {
  days: DayRow[];
}

const COL_HEADERS = ['E1', 'S1', 'E2', 'S2', 'E3', 'S3', 'E4', 'S4'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const LEGEND = [
  { label: 'REP',           color: '#2563EB' },
  { label: 'Mobile / Web',  color: '#9333EA' },
  { label: 'Manual',        color: '#64748B' },
  { label: 'Inconsistente', color: '#EF4444' },
];

export function PunchGrid({ days }: PunchGridProps) {
  const [menuCtx, setMenuCtx] = useState<DayActionMenuContext | null>(null);

  const handleCellOpen = useCallback((dayLabel: string, slotLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuCtx({ dayLabel, slotLabel, x: e.clientX + 8, y: e.clientY + 8 });
  }, []);

  const handleMenuClose = useCallback(() => setMenuCtx(null), []);

  return (
    <div className={styles.outer}>
      <div className={styles.gridWrap}>
        <div className={styles.legendBar}>
          {LEGEND.map((item) => (
            <span key={item.label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.thDate}>Data</th>
              {COL_HEADERS.map((h) => (
                <th key={h} className={styles.thPunch}>{h}</th>
              ))}
              <th className={styles.thStatus}>Status do Dia</th>
              <th className={styles.thActions} />
            </tr>
          </thead>
          <tbody>
            {days.map((row, idx) => {
              const prevRow = days[idx - 1];
              const isNewMonth = !prevRow || prevRow.month !== row.month || prevRow.year !== row.year;
              const showSeparator = isNewMonth && idx > 0;
              return (
                <>
                  {showSeparator && (
                    <tr key={`sep-${row.year}-${row.month}`} className={styles.monthSepRow}>
                      <td colSpan={11} className={styles.monthSepCell}>
                        {MONTH_NAMES[row.month - 1]} {row.year}
                      </td>
                    </tr>
                  )}
                  <PunchRow
                    key={`${row.year}-${row.month}-${row.day}`}
                    row={row}
                    onCellOpen={handleCellOpen}
                  />
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.sidePanel}>
        <button type="button" className={styles.panelToggle} title="Expandir painel">
          <PanelRightOpen size={16} />
        </button>
        <span className={styles.panelLabel}>Painel lateral</span>
      </div>

      {menuCtx && (
        <DayActionMenu ctx={menuCtx} onClose={handleMenuClose} />
      )}
    </div>
  );
}
