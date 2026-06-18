import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { PanelRightOpen } from 'lucide-react';
import type { DayRow } from '../../types';
import { PunchRow, type CellDragHandlers } from './PunchRow';
import { DayActionMenu, type DayActionMenuContext } from './DayActionMenu';
import { OcorrenciaModal } from './OcorrenciaModal';
import { JustificativaManualModal } from './JustificativaManualModal';
import { excluirBatida, editarBatida } from '../../../../services/fichaPontoApi';
import { lancarBatida } from '../../../../services/fichaPontoApi';
import { deleteOcorrencia } from '../../../../services/ocorrenciasApi';
import styles from './PunchGrid.module.css';

interface PunchGridProps {
  days: DayRow[];
  funcionarioId: number;
  funcionarioNome: string;
  turnoId: number | null;
  tzOffset: string | null;
  onReload: () => void;
  reloading?: boolean;
}

const COL_HEADERS = ['E1', 'S1', 'E2', 'S2', 'E3', 'S3', 'E4', 'S4'];
const SLOT_LABELS = ['E1', 'S1', 'E2', 'S2', 'E3', 'S3', 'E4', 'S4'];

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

interface OcorrenciaModalState {
  dataInicio: string;
  dataFim: string;
}

interface DragState {
  row: DayRow;
  slotIndex: number;
  punchId: number;
  time: string;
}

interface ConfirmMoveState {
  from: DragState;
  toRow: DayRow;
  toSlotIndex: number;
}

const makeCellKey = (row: DayRow, slotIndex: number) =>
  `${row.year}-${row.month}-${row.day}-${slotIndex}`;

const formatDay = (row: DayRow) =>
  `${String(row.day).padStart(2, '0')}/${String(row.month).padStart(2, '0')}`;

export function PunchGrid({ days, funcionarioId, funcionarioNome, turnoId, tzOffset, onReload, reloading }: PunchGridProps) {
  const [menuCtx, setMenuCtx] = useState<DayActionMenuContext | null>(null);
  const [ocorrenciaModal, setOcorrenciaModal] = useState<OcorrenciaModalState | null>(null);
  const [justManualCtx, setJustManualCtx] = useState<DayActionMenuContext | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);

  // Drag state (pointer-events based — sem HTML5 Drag API)
  const dragStateRef = useRef<DragState | null>(null);
  const pendingDragRef = useRef<(DragState & { startX: number; startY: number }) | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const daysRef = useRef<DayRow[]>(days);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<ConfirmMoveState | null>(null);
  const [moving, setMoving] = useState(false);

  // Mantém daysRef atualizado para usar dentro dos event listeners globais
  useEffect(() => { daysRef.current = days; }, [days]);

  useEffect(() => {
    if (gridWrapRef.current) {
      gridWrapRef.current.scrollTop = 0;
    }
  }, [funcionarioId]);

  const handleCellOpen = useCallback((dayLabel: string, slotLabel: string, row: DayRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuCtx({ dayLabel, slotLabel, x: e.clientX + 8, y: e.clientY + 8, row, funcionarioId, turnoId });
  }, [funcionarioId, turnoId]);

  const handleMenuClose = useCallback(() => setMenuCtx(null), []);

  function showMsg(type: 'ok' | 'error', text: string) {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  }

  // ── Drag com Pointer Events (confiável em tabelas com scroll) ─────────────

  const showGhost = useCallback((time: string, x: number, y: number) => {
    if (ghostRef.current) document.body.removeChild(ghostRef.current);
    const el = document.createElement('div');
    el.textContent = time;
    Object.assign(el.style, {
      position: 'fixed', left: `${x - 28}px`, top: `${y - 16}px`,
      background: '#fff', border: '2px solid #10B981', borderRadius: '8px',
      padding: '3px 10px', fontSize: '13px', fontWeight: '700',
      fontFamily: 'monospace', pointerEvents: 'none', zIndex: '9999',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)', color: '#0F172A',
    });
    document.body.appendChild(el);
    ghostRef.current = el;
  }, []);

  const removeGhost = useCallback(() => {
    if (ghostRef.current) { document.body.removeChild(ghostRef.current); ghostRef.current = null; }
  }, []);

  const findDropTarget = useCallback((x: number, y: number): { td: HTMLElement; key: string } | null => {
    const ghost = ghostRef.current;
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = '';
    const td = (el as HTMLElement)?.closest?.('[data-cellkey]') as HTMLElement | null;
    if (!td || td.dataset.filled !== 'false') return null;
    const key = td.dataset.cellkey ?? '';
    const srcKey = dragStateRef.current ? makeCellKey(dragStateRef.current.row, dragStateRef.current.slotIndex) : '';
    if (!key || key === srcKey) return null;
    return { td, key };
  }, []);

  // Listeners globais — registrados uma vez, usam refs para acesso ao estado
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Ainda não iniciou o drag: verifica se passou do threshold
      if (pendingDragRef.current && !dragStateRef.current) {
        const { startX, startY, ...state } = pendingDragRef.current;
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dist >= 5) {
          pendingDragRef.current = null;
          dragStateRef.current = state;
          setDraggingKey(makeCellKey(state.row, state.slotIndex));
          showGhost(state.time, e.clientX, e.clientY);
        }
        return;
      }

      if (!dragStateRef.current) return;
      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX - 28}px`;
        ghostRef.current.style.top = `${e.clientY - 16}px`;
      }
      const hit = findDropTarget(e.clientX, e.clientY);
      setDragOverKey(hit ? hit.key : null);
    };

    const onUp = (e: PointerEvent) => {
      // Soltar sem ter iniciado drag = click normal, apenas limpa o pending
      if (pendingDragRef.current) {
        pendingDragRef.current = null;
        return;
      }

      const src = dragStateRef.current;
      if (!src) return;

      const hit = findDropTarget(e.clientX, e.clientY);
      dragStateRef.current = null;
      removeGhost();
      setDraggingKey(null);
      setDragOverKey(null);

      if (!hit) return;
      const parts = hit.key.split('-').map(Number);
      const [year, month, day, slotIndex] = parts;
      const targetRow = daysRef.current.find(r => r.year === year && r.month === month && r.day === day);
      if (!targetRow) return;
      setConfirmMove({ from: src, toRow: targetRow, toSlotIndex: slotIndex });
    };

    const onCancel = () => {
      pendingDragRef.current = null;
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      removeGhost();
      setDraggingKey(null);
      setDragOverKey(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [findDropTarget, removeGhost, showGhost]);

  const handleCellPointerDown = useCallback((row: DayRow, slotIndex: number, e: React.PointerEvent) => {
    const punchId = row.punchIds[slotIndex];
    const punch = row.punches[slotIndex];
    if (punchId == null || !punch) return;
    // Registra intenção de drag mas NÃO inicia ainda — aguarda movimento > threshold
    pendingDragRef.current = {
      row, slotIndex, punchId, time: punch.time,
      startX: e.clientX, startY: e.clientY,
    };
  }, []);

  const dragHandlers = useMemo<CellDragHandlers>(() => ({
    onPointerDown: handleCellPointerDown,
  }), [handleCellPointerDown]);

  // ── Confirm move ───────────────────────────────────────────────────────────

  async function handleConfirmMove() {
    if (!confirmMove) return;
    const { from, toRow } = confirmMove;

    const isSameDay = from.row.year === toRow.year &&
      from.row.month === toRow.month &&
      from.row.day === toRow.day;

    const pad = (n: number) => String(n).padStart(2, '0');

    setMoving(true);
    try {
      if (isSameDay) {
        // Mesmo dia: altera data_hora para reordenar + slot_override para fixar posição
        const [hh, mm] = from.time.split(':').map(Number);
        const localDate = new Date(toRow.year, toRow.month - 1, toRow.day, hh, mm, 0);
        const data_hora = localDate.toISOString().replace('T', ' ').slice(0, 19);
        await editarBatida(from.punchId, {
          data_hora,
          motivo: 'Movido manualmente',
          slot_override: confirmMove.toSlotIndex,
        });
      } else {
        // Dia diferente (turno noturno): mantém data_hora original intacta para cálculo
        // correto de horas no espelho. Usa dia_referencia para agrupar a batida no dia
        // destino na exibição da ficha.
        const dia_referencia = `${toRow.year}-${pad(toRow.month)}-${pad(toRow.day)}`;
        await editarBatida(from.punchId, {
          dia_referencia,
          motivo: 'Movido manualmente',
          slot_override: confirmMove.toSlotIndex,
        });
      }
      showMsg('ok', `Batida ${from.time} movida do dia ${formatDay(from.row)} para ${formatDay(toRow)} com sucesso.`);
      setConfirmMove(null);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível mover a batida. Tente novamente.');
    } finally {
      setMoving(false);
    }
  }

  // ── Existing action handlers ───────────────────────────────────────────────

  async function handleAbonar(ctx: DayActionMenuContext) {
    const slotIndex = SLOT_LABELS.indexOf(ctx.slotLabel);
    const punchId = ctx.row.punchIds[slotIndex];
    if (punchId == null) {
      showMsg('error', `Célula ${ctx.slotLabel} de ${ctx.dayLabel} não possui marcação para abonar.`);
      return;
    }
    try {
      await excluirBatida(punchId);
      showMsg('ok', `Marcação ${ctx.slotLabel} de ${ctx.dayLabel} abonada com sucesso.`);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível abonar a marcação.');
    }
  }

  function handleLancarOcorrencia(ctx: DayActionMenuContext) {
    const { row } = ctx;
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${row.year}-${pad(row.month)}-${pad(row.day)}`;
    setOcorrenciaModal({ dataInicio: date, dataFim: date });
  }

  async function handleJustificativaAutomatica(ctx: DayActionMenuContext) {
    const { row, funcionarioId: funcId } = ctx;
    const times = row.horariosPrevistos;

    if (times.length === 0) {
      showMsg('error', 'Nenhum horário previsto configurado para este dia. Verifique o turno ou escala do funcionário.');
      return;
    }

    // Só lança batidas nos slots que ainda estão vazios
    const timesToFill = times.filter((_: string, i: number) => row.punches[i] == null);

    if (timesToFill.length === 0) {
      showMsg('error', 'Todos os horários previstos já estão preenchidos.');
      return;
    }

    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const datePrefix = `${row.year}-${pad(row.month)}-${pad(row.day)}`;
      const offset = tzOffset ?? '-03:00';

      const toUtc = (localTime: string): string => {
        const full = localTime.length === 5 ? localTime + ':00' : localTime;
        const d = new Date(`${datePrefix}T${full}${offset}`);
        return d.toISOString().replace('T', ' ').slice(0, 19);
      };

      await Promise.all(
        timesToFill.map((t: string) => lancarBatida({
          funcionario_id: funcId,
          data_hora: toUtc(t),
          motivo: 'Justificativa automática',
        }))
      );
      showMsg('ok', `${timesToFill.length} batida(s) lançada(s) manualmente (${timesToFill.join(', ')}).`);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível lançar as batidas automáticas.');
    }
  }

  function handleJustificativaManual(ctx: DayActionMenuContext) {
    const slotIndex = SLOT_LABELS.indexOf(ctx.slotLabel);
    if (ctx.row.punchIds[slotIndex] != null) {
      showMsg('error', `A célula ${ctx.slotLabel} de ${ctx.dayLabel} já possui uma batida. Abona a batida primeiro e depois lance a justificativa.`);
      return;
    }
    setJustManualCtx(ctx);
  }

  async function handleExcluirOcorrencia(ctx: DayActionMenuContext) {
    const { row } = ctx;
    if (!row.ocorrenciaId) {
      showMsg('error', `Nenhuma ocorrência registrada em ${ctx.dayLabel}.`);
      return;
    }
    try {
      await deleteOcorrencia(row.ocorrenciaId);
      showMsg('ok', `Ocorrência de ${ctx.dayLabel} excluída com sucesso.`);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível excluir a ocorrência.');
    }
  }

  async function handleExcluirJustificativaManual(ctx: DayActionMenuContext) {
    const slotIndex = SLOT_LABELS.indexOf(ctx.slotLabel);
    const punchId = ctx.row.punchIds[slotIndex];
    const motivo = ctx.row.punchMotivos[slotIndex];

    if (punchId == null) {
      showMsg('error', `Célula ${ctx.slotLabel} de ${ctx.dayLabel} não possui marcação.`);
      return;
    }
    const MOTIVOS_SISTEMA = ['Justificativa automática', 'Movido manualmente', 'ESQUECIMENTO'];
    if (!motivo || MOTIVOS_SISTEMA.includes(motivo)) {
      showMsg('error', `Célula ${ctx.slotLabel} de ${ctx.dayLabel} não possui justificativa manual.`);
      return;
    }
    try {
      await excluirBatida(punchId);
      showMsg('ok', `Justificativa manual da célula ${ctx.slotLabel} de ${ctx.dayLabel} excluída com sucesso.`);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível excluir a justificativa manual.');
    }
  }

  async function handleExcluirJustificativaAutomatica(ctx: DayActionMenuContext) {
    const { row } = ctx;
    const idsParaExcluir = row.punchIds.filter(
      (_, i) => row.punchMotivos[i] === 'Justificativa automática'
    );
    if (idsParaExcluir.length === 0) {
      showMsg('error', `Nenhuma justificativa automática encontrada em ${ctx.dayLabel}.`);
      return;
    }
    try {
      await Promise.all(idsParaExcluir.map((id) => excluirBatida(id)));
      showMsg('ok', `${idsParaExcluir.length} batida(s) de justificativa automática excluída(s) em ${ctx.dayLabel}.`);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível excluir as batidas da justificativa automática.');
    }
  }

  return (
    <div className={styles.outer}>
      {reloading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 3, background: 'linear-gradient(90deg,#3B82F6 0%,#60A5FA 50%,#3B82F6 100%)',
          backgroundSize: '200% 100%',
          animation: 'sp-loading-bar 1.2s linear infinite',
          zIndex: 10,
        }} />
      )}

      {actionMsg && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 3000,
          padding: '0.65rem 1rem',
          borderRadius: 10,
          background: actionMsg.type === 'ok' ? '#ecfdf5' : '#fee2e2',
          color: actionMsg.type === 'ok' ? '#065f46' : '#991b1b',
          fontWeight: 600, fontSize: '0.88rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {actionMsg.text}
        </div>
      )}

      <div ref={gridWrapRef} className={styles.gridWrap}>
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
                    dragHandlers={dragHandlers}
                    draggingKey={draggingKey}
                    dragOverKey={dragOverKey}
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
        <DayActionMenu
          ctx={menuCtx}
          onClose={handleMenuClose}
          onAbonar={(ctx) => void handleAbonar(ctx)}
          onLancarOcorrencia={handleLancarOcorrencia}
          onJustificativaAutomatica={(ctx) => void handleJustificativaAutomatica(ctx)}
          onJustificativaManual={handleJustificativaManual}
          onExcluirOcorrencia={(ctx) => void handleExcluirOcorrencia(ctx)}
          onExcluirJustificativaAutomatica={(ctx) => void handleExcluirJustificativaAutomatica(ctx)}
          onExcluirJustificativaManual={(ctx) => void handleExcluirJustificativaManual(ctx)}
        />
      )}

      {ocorrenciaModal && (
        <OcorrenciaModal
          funcionarioId={funcionarioId}
          funcionarioNome={funcionarioNome}
          dataInicio={ocorrenciaModal.dataInicio}
          dataFim={ocorrenciaModal.dataFim}
          onClose={() => setOcorrenciaModal(null)}
          onSuccess={() => {
            setOcorrenciaModal(null);
            showMsg('ok', 'Ocorrência lançada com sucesso.');
            onReload();
          }}
        />
      )}

      {justManualCtx && (
        <JustificativaManualModal
          ctx={justManualCtx}
          funcionarioNome={funcionarioNome}
          tzOffset={tzOffset}
          onClose={() => setJustManualCtx(null)}
          onSuccess={() => {
            setJustManualCtx(null);
            showMsg('ok', 'Justificativa manual salva com sucesso.');
            onReload();
          }}
        />
      )}

      {/* Modal de confirmação de mover batida */}
      {confirmMove && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 4000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '1.75rem 2rem',
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            maxWidth: 440, width: '90%',
          }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
              Mover batida
            </h3>

            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#475569', lineHeight: 1.7 }}>
              Mover a batida{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{confirmMove.from.time}</strong>{' '}
              de{' '}
              <strong style={{ color: '#0F172A' }}>{SLOT_LABELS[confirmMove.from.slotIndex]}</strong>{' '}
              do dia{' '}
              <strong style={{ color: '#0F172A' }}>{formatDay(confirmMove.from.row)}</strong>{' '}
              para{' '}
              <strong style={{ color: '#10B981' }}>{SLOT_LABELS[confirmMove.toSlotIndex]}</strong>{' '}
              do dia{' '}
              <strong style={{ color: '#10B981' }}>{formatDay(confirmMove.toRow)}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmMove(null)}
                disabled={moving}
                style={{
                  padding: '0.5rem 1.1rem', borderRadius: 8,
                  border: '1px solid #E2E8F0', background: '#fff',
                  color: '#475569', cursor: 'pointer', fontWeight: 500,
                  fontSize: '0.875rem', transition: 'background 0.1s',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleConfirmMove()}
                disabled={moving}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: 8,
                  border: 'none', background: moving ? '#6EE7B7' : '#10B981',
                  color: '#fff', cursor: moving ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.875rem', transition: 'background 0.15s',
                }}
              >
                {moving ? 'Movendo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
