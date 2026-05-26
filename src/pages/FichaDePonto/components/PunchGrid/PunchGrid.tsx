import { useState, useCallback } from 'react';
import { PanelRightOpen } from 'lucide-react';
import type { DayRow } from '../../types';
import { PunchRow } from './PunchRow';
import { DayActionMenu, type DayActionMenuContext } from './DayActionMenu';
import { OcorrenciaModal } from './OcorrenciaModal';
import { excluirBatida } from '../../../../services/fichaPontoApi';
import { lancarBatida } from '../../../../services/fichaPontoApi';
import { fetchTurnoById, fetchTurnoHorarios } from '../../../../services/turnosApi';
import { deleteOcorrencia } from '../../../../services/ocorrenciasApi';
import styles from './PunchGrid.module.css';

interface PunchGridProps {
  days: DayRow[];
  funcionarioId: number;
  funcionarioNome: string;
  turnoId: number | null;
  onReload: () => void;
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

interface OcorrenciaModalState {
  dataInicio: string;
  dataFim: string;
}

export function PunchGrid({ days, funcionarioId, funcionarioNome, turnoId, onReload }: PunchGridProps) {
  const [menuCtx, setMenuCtx] = useState<DayActionMenuContext | null>(null);
  const [ocorrenciaModal, setOcorrenciaModal] = useState<OcorrenciaModalState | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleCellOpen = useCallback((dayLabel: string, slotLabel: string, row: DayRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuCtx({ dayLabel, slotLabel, x: e.clientX + 8, y: e.clientY + 8, row, funcionarioId, turnoId });
  }, [funcionarioId, turnoId]);

  const handleMenuClose = useCallback(() => setMenuCtx(null), []);

  function showMsg(type: 'ok' | 'error', text: string) {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function handleAbonar(ctx: DayActionMenuContext) {
    const SLOT_LABELS = ['E1', 'S1', 'E2', 'S2', 'E3', 'S3', 'E4', 'S4'];
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
    const { row, funcionarioId: funcId, turnoId: tId } = ctx;
    if (!tId) {
      showMsg('error', 'Funcionário sem turno definido. Não é possível gerar justificativa automática.');
      return;
    }
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const datePrefix = `${row.year}-${pad(row.month)}-${pad(row.day)}`;

      const diaSemana = new Date(row.year, row.month - 1, row.day).getDay();
      const [horarios, turno] = await Promise.all([fetchTurnoHorarios(tId), fetchTurnoById(tId)]);
      const horarioDia = horarios.find((h) => h.dia_semana === diaSemana);

      if (horarioDia && !horarioDia.trabalha) {
        showMsg('error', 'Este dia é folga no turno do funcionário.');
        return;
      }

      const fonte = horarioDia ?? turno;
      if (!fonte) {
        showMsg('error', 'Turno do funcionário não encontrado.');
        return;
      }

      const times = [fonte.entrada, fonte.saida_intervalo, fonte.retorno_intervalo, fonte.saida]
        .filter(Boolean) as string[];

      if (times.length === 0) {
        showMsg('error', 'Nenhum horário configurado no turno deste funcionário.');
        return;
      }

      // Horários do turno são locais (UTC-3); converter para UTC antes de enviar,
      // pois o backend salva data_hora como UTC e aplica CONVERT_TZ na leitura.
      const toUtc = (localTime: string): string => {
        const full = localTime.length === 5 ? localTime + ':00' : localTime;
        const [h, m, s] = full.split(':').map(Number);
        const d = new Date(`${datePrefix}T${pad(h)}:${pad(m)}:${pad(s || 0)}`);
        d.setHours(d.getHours() + 3);
        return d.toISOString().replace('T', ' ').slice(0, 19);
      };

      await Promise.all(
        times.map((t) => lancarBatida({
          funcionario_id: funcId,
          data_hora: toUtc(t),
          motivo: 'Justificativa automática',
        }))
      );
      showMsg('ok', `${times.length} batida(s) lançada(s) manualmente (${times.join(', ')}).`);
      onReload();
    } catch {
      showMsg('error', 'Não foi possível lançar as batidas automáticas.');
    }
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
        <DayActionMenu
          ctx={menuCtx}
          onClose={handleMenuClose}
          onAbonar={(ctx) => void handleAbonar(ctx)}
          onLancarOcorrencia={handleLancarOcorrencia}
          onJustificativaAutomatica={(ctx) => void handleJustificativaAutomatica(ctx)}
          onExcluirOcorrencia={(ctx) => void handleExcluirOcorrencia(ctx)}
          onExcluirJustificativaAutomatica={(ctx) => void handleExcluirJustificativaAutomatica(ctx)}
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
    </div>
  );
}
