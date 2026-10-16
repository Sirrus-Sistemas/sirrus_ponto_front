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
  onDesconsiderar: (ctx: DayActionMenuContext) => void;
  onReconsiderar: (ctx: DayActionMenuContext) => void;
  onLancarOcorrencia: (ctx: DayActionMenuContext) => void;
  onJustificativaAutomatica: (ctx: DayActionMenuContext) => void;
  onJustificativaManual: (ctx: DayActionMenuContext) => void;
  onExcluirOcorrencia: (ctx: DayActionMenuContext) => void;
  onExcluirJustificativaAutomatica: (ctx: DayActionMenuContext) => void;
  onExcluirJustificativaManual: (ctx: DayActionMenuContext) => void;
}

export function DayActionMenu({ ctx, onClose, onDesconsiderar, onReconsiderar, onLancarOcorrencia, onJustificativaAutomatica, onJustificativaManual, onExcluirOcorrencia, onExcluirJustificativaAutomatica, onExcluirJustificativaManual }: DayActionMenuProps) {
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
  const menuHeight = 320;
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
          onClick={() => { onClose(); onDesconsiderar(ctx); }}
        >
          {/* Antes "Abonar" — que apagava a batida, inclusive a do relógio.
              Manual é excluída; relógio/app só sai do cálculo. */}
          <span className={styles.itemLabel}>Desconsiderar batida</span>
        </button>

        {(ctx.row.desconsideradas?.length ?? 0) > 0 && (
          <button
            type="button"
            className={styles.item}
            onClick={() => { onClose(); onReconsiderar(ctx); }}
          >
            <span className={styles.itemLabel}>
              Reconsiderar batidas ({ctx.row.desconsideradas!.map((d) => d.time).join(', ')})
            </span>
          </button>
        )}

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

        <button
          type="button"
          className={styles.item}
          onClick={() => { onClose(); onJustificativaManual(ctx); }}
        >
          <span className={styles.itemLabel}>Justificativa Manual</span>
        </button>

        <button
          type="button"
          className={`${styles.item} ${styles.itemDanger}`}
          onClick={() => { onClose(); onExcluirOcorrencia(ctx); }}
        >
          {/* O dia com ocorrência aparece como "Abonado" na grade — o nome
              do item precisa bater com isso, senão ninguém acha como desfazer. */}
          <span className={styles.itemLabel}>
            {ctx.row.ocorrencias?.length
              ? `Excluir Abono / Ocorrência (${ctx.row.ocorrencias.map((o) => o.nome).join(', ')})`
              : 'Excluir Abono / Ocorrência'}
          </span>
        </button>

        <button
          type="button"
          className={`${styles.item} ${styles.itemDanger}`}
          onClick={() => { onClose(); onExcluirJustificativaAutomatica(ctx); }}
        >
          <span className={styles.itemLabel}>Excluir Justificativa Automática</span>
        </button>

        <button
          type="button"
          className={`${styles.item} ${styles.itemDanger}`}
          onClick={() => { onClose(); onExcluirJustificativaManual(ctx); }}
        >
          <span className={styles.itemLabel}>Excluir Justificativa Manual</span>
        </button>
      </div>
    </div>
  );
}
