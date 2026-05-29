import { MoreHorizontal } from 'lucide-react';
import type { DayRow } from '../../types';
import { PunchCell } from './PunchCell';
import { DayStatusBadge } from './DayStatusBadge';
import styles from './PunchRow.module.css';

const DOW_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const SLOT_LABELS = ['E1', 'S1', 'E2', 'S2', 'E3', 'S3', 'E4', 'S4'];

export interface CellDragHandlers {
  onPointerDown: (row: DayRow, slotIndex: number, e: React.PointerEvent) => void;
}

interface PunchRowProps {
  row: DayRow;
  onCellOpen?: (dayLabel: string, slotLabel: string, row: DayRow, e: React.MouseEvent) => void;
  dragHandlers?: CellDragHandlers;
  draggingKey?: string | null;
  dragOverKey?: string | null;
}

export function PunchRow({ row, onCellOpen, dragHandlers, draggingKey, dragOverKey }: PunchRowProps) {
  const month = row.month;
  const isSat = row.dow === 6;
  const isSun = row.dow === 0;
  const isWeekend = isSat || isSun;
  const isFeriado = row.modifiers?.includes('feriado') ?? false;

  const rowClass = [
    styles.row,
    isSun ? styles.rowSun : isSat ? styles.rowSat : '',
    isFeriado ? styles.rowFeriado : '',
    row.isToday ? styles.rowToday : '',
  ].filter(Boolean).join(' ');

  const dayLabel = `${String(row.day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  const isInconsistente = row.status === 'inconsistente';

  return (
    <tr className={rowClass}>
      <td className={styles.tdDate}>
        <span className={styles.dateNum}>{dayLabel}</span>
        <span className={`${styles.dateDow} ${isWeekend ? styles.weekend : ''}`}>
          {DOW_LABELS[row.dow]}
        </span>
      </td>

      {row.punches.map((punch, i) => {
        const isMissing = isInconsistente && punch === null && i < 4;
        const slotLabel = SLOT_LABELS[i];
        const handleOpen = (e: React.MouseEvent) => onCellOpen?.(dayLabel, slotLabel, row, e);

        const cellKey = `${row.year}-${row.month}-${row.day}-${i}`;
        const isDragging = draggingKey === cellKey;
        const isDragOver = dragOverKey === cellKey;
        const isFilled = punch !== null;

        return (
          <td
            key={i}
            className={styles.tdCell}
            data-cellkey={cellKey}
            data-filled={isFilled ? 'true' : 'false'}
          >
            <PunchCell
              punch={punch}
              isMissing={isMissing}
              onClick={handleOpen}
              onDoubleClick={handleOpen}
              isDragging={isDragging}
              isDragOver={isDragOver}
              onPointerDown={punch && dragHandlers
                ? (e) => dragHandlers.onPointerDown(row, i, e)
                : undefined}
            />
          </td>
        );
      })}

      <td className={styles.tdStatus}>
        <DayStatusBadge status={row.status} modifiers={row.modifiers} />
      </td>

      <td className={styles.tdActions}>
        <button type="button" className={styles.moreBtn} title="Ações">
          <MoreHorizontal size={15} />
        </button>
      </td>
    </tr>
  );
}
