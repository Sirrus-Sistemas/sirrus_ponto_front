import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { DatePicker } from '../../../../components/ui/DatePicker';
import { ApiError } from '../../../../lib/api';
import { fetchTurnos, type Turno } from '../../../../services/turnosApi';
import { previewEscalaPorTurno, salvarEscalaPorTurno, type DiaEscala } from '../../../../services/escalasApi';
import styles from './OcorrenciaModal.module.css';

interface AlterarTabelaHorarioModalProps {
  funcionarioId: number;
  funcionarioNome: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  onClose: () => void;
  onSuccess: () => void;
}

export function AlterarTabelaHorarioModal({
  funcionarioId,
  funcionarioNome,
  dataInicio,
  dataFim,
  onClose,
  onSuccess,
}: AlterarTabelaHorarioModalProps) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [turnoId, setTurnoId] = useState('');
  const [inicio, setInicio] = useState(dataInicio);
  const [fim, setFim] = useState(dataFim);
  const [preview, setPreview] = useState<DiaEscala[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTurnos().then(setTurnos).catch(() => setTurnos([]));
  }, []);

  // Pré-visualiza assim que período + tabela estão válidos — mesma lógica de
  // preview automático usada em Gerar Escala, pra dar confiança antes de
  // sobrescrever os dias (o salvar apaga e regrava a escala do período).
  useEffect(() => {
    if (!turnoId || !inicio || !fim || fim < inicio) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelado = false;
    previewEscalaPorTurno({ funcionario_id: funcionarioId, data_inicio: inicio, data_fim: fim, turno_id: Number(turnoId) })
      .then((dias) => { if (!cancelado) { setPreview(dias); setPreviewError(null); } })
      .catch((err) => {
        if (!cancelado) {
          setPreview(null);
          setPreviewError(err instanceof ApiError ? err.message : 'Não foi possível pré-visualizar.');
        }
      });
    return () => { cancelado = true; };
  }, [funcionarioId, turnoId, inicio, fim]);

  const setTurnoIdSafe = useCallback((v: string) => setTurnoId(v), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!inicio) { setError('Informe a data inicial.'); return; }
    if (!fim)    { setError('Informe a data final.'); return; }
    if (fim < inicio) { setError('Data final não pode ser anterior à data inicial.'); return; }
    if (!turnoId) { setError('Selecione a tabela de horário.'); return; }

    setSubmitting(true);
    try {
      await salvarEscalaPorTurno({
        funcionario_id: funcionarioId,
        data_inicio: inicio,
        data_fim: fim,
        turno_id: Number(turnoId),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aplicar a tabela de horário.');
    } finally {
      setSubmitting(false);
    }
  }

  const diasTrabalho = preview?.filter((d) => d.tipo === 'trabalho').length ?? 0;
  const diasFolga = preview?.filter((d) => d.tipo === 'folga').length ?? 0;

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Alterar Tabela de Horário por Período</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.funcRow}>
          <span className={styles.funcLabel}>Funcionário</span>
          <span className={styles.funcName}>{funcionarioNome}</span>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="ath-inicio">Data inicial</label>
              <DatePicker id="ath-inicio" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="ath-fim">Data final</label>
              <DatePicker id="ath-fim" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="ath-turno">Tabela de horário</label>
            <select
              id="ath-turno"
              value={turnoId}
              onChange={(e) => setTurnoIdSafe(e.target.value)}
            >
              <option value="">Selecione…</option>
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>

          {previewError && <p className={styles.error} role="alert">{previewError}</p>}
          {preview && preview.length > 0 && (
            <p className={styles.helperText}>
              {diasTrabalho} dia(s) de trabalho e {diasFolga} dia(s) de folga serão gravados nesse período,
              substituindo a escala/turno que estava valendo nessas datas.
            </p>
          )}

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting || !preview}>
              {submitting ? 'Aplicando…' : 'Aplicar tabela de horário'}
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
