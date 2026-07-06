import { type FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError } from '../../../../lib/api';
import { lancarBatida, editarBatida } from '../../../../services/fichaPontoApi';
import type { DayActionMenuContext } from './DayActionMenu';
import styles from './OcorrenciaModal.module.css';

const SLOT_LABELS = ['E1', 'S1', 'E2', 'S2', 'E3', 'S3', 'E4', 'S4'];

interface JustificativaManualModalProps {
  ctx: DayActionMenuContext;
  funcionarioNome: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function JustificativaManualModal({
  ctx,
  funcionarioNome,
  onClose,
  onSuccess,
}: JustificativaManualModalProps) {
  const slotIndex = SLOT_LABELS.indexOf(ctx.slotLabel);
  const existingPunch = ctx.row.punches[slotIndex];
  const existingPunchId: number | undefined = ctx.row.punchIds[slotIndex];
  const existingMotivo = ctx.row.punchMotivos[slotIndex];

  const pad = (n: number) => String(n).padStart(2, '0');
  const displayDate = `${pad(ctx.row.day)}/${pad(ctx.row.month)}/${ctx.row.year}`;

  const [justificativa, setJustificativa] = useState(
    existingMotivo && existingMotivo !== 'Justificativa automática' ? existingMotivo : '',
  );
  const [horario, setHorario] = useState(existingPunch?.time ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!justificativa.trim()) {
      setError('Informe a justificativa.');
      return;
    }

    // Se não há batida existente, precisa lançar uma nova com horário
    if (existingPunchId == null) {
      if (!horario.trim()) {
        setError('Informe o horário para lançar a batida.');
        return;
      }

      setSubmitting(true);
      try {
        const [hh, mm] = horario.split(':');
        const dataHora = `${ctx.row.year}-${pad(ctx.row.month)}-${pad(ctx.row.day)} ${hh}:${mm}:00`;
        await lancarBatida({
          funcionario_id: ctx.funcionarioId,
          data_hora: dataHora,
          justificativa: justificativa.trim(),
          slot_override: slotIndex,
        });
        onSuccess();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível lançar a batida.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Se há batida existente, apenas atualiza a justificativa
    setSubmitting(true);
    try {
      await editarBatida(existingPunchId, {
        justificativa: justificativa.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a justificativa.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Justificativa Manual</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.funcRow}>
          <span className={styles.funcLabel}>Funcionário</span>
          <span className={styles.funcName}>{funcionarioNome}</span>
        </div>

        <div className={styles.funcRow} style={{ marginBottom: '1.25rem' }}>
          <span className={styles.funcLabel}>Célula</span>
          <span className={styles.funcName}>{ctx.slotLabel} · {displayDate}</span>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          {existingPunchId == null && (
            <div className={styles.field} style={{ marginBottom: '0.85rem' }}>
              <label htmlFor="jm-horario">Horário (HH:MM)</label>
              <input
                id="jm-horario"
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.field} style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="jm-justificativa">Justificativa</label>
            <textarea
              id="jm-justificativa"
              placeholder="Descreva o motivo…"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              maxLength={500}
              required
            />
            {existingPunchId != null && (
              <small style={{ display: 'block', marginTop: '0.4rem', color: '#64748B', fontSize: '0.8rem' }}>
                Para editar horário, use drag/reorder.
              </small>
            )}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : existingPunchId != null ? 'Salvar alteração' : 'Lançar batida'}
            </button>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
