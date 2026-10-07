import { type FormEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import { ApiError } from '../../../../lib/api';
import { fetchOcorrencias, TURNO_LABELS, TIPO_HORA_LABELS, type Ocorrencia } from '../../../../services/ocorrenciasApi';
import styles from './ExcluirOcorrenciasPeriodoModal.module.css';

type ExcluirResultado = { excluidas: number };

interface Props {
  funcionarioId: number;
  funcionarioNome: string;
  defaultDataInicio: string;
  defaultDataFim: string;
  onClose: () => void;
  onExcluir: (params: { funcionario_id: number; data_inicio: string; data_fim: string }) => Promise<ExcluirResultado>;
}

function formatPeriodo(o: Ocorrencia): string {
  const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return o.data_inicio === o.data_fim ? fmt(o.data_inicio) : `${fmt(o.data_inicio)} – ${fmt(o.data_fim)}`;
}

export function ExcluirOcorrenciasPeriodoModal({
  funcionarioId,
  funcionarioNome,
  defaultDataInicio,
  defaultDataFim,
  onClose,
  onExcluir,
}: Props) {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<Ocorrencia[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ExcluirResultado | null>(null);

  async function handleBuscar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!dataInicio) { setError('Informe a data início.'); return; }
    if (!dataFim) { setError('Informe a data fim.'); return; }
    if (dataFim < dataInicio) { setError('Data fim deve ser igual ou posterior à data início.'); return; }

    setLoadingPreview(true);
    try {
      const rows = await fetchOcorrencias({ funcionario_id: funcionarioId, data_inicio: dataInicio, data_fim: dataFim });
      setPreview(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível buscar as ocorrências do período.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirmar() {
    setError(null);
    setSubmitting(true);
    try {
      const r = await onExcluir({ funcionario_id: funcionarioId, data_inicio: dataInicio, data_fim: dataFim });
      setResultado(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir as ocorrências do período.');
    } finally {
      setSubmitting(false);
    }
  }

  if (resultado) {
    return (
      <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Excluir Ocorrências</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>
          <div className={styles.successBox}>
            <CheckCircle2 size={32} className={styles.successIcon} />
            <p className={styles.successTitle}>
              {resultado.excluidas} {resultado.excluidas === 1 ? 'ocorrência excluída' : 'ocorrências excluídas'}!
            </p>
            <p className={styles.successSub}>Período de {funcionarioNome} atualizado.</p>
            <button type="button" className={styles.btnPrimary} onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Excluir Ocorrências</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>

        <div className={styles.funcRow}>
          <span className={styles.funcLabel}>Funcionário</span>
          <span className={styles.funcName}>{funcionarioNome}</span>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {preview === null ? (
          <form onSubmit={handleBuscar} noValidate>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label htmlFor="eo-inicio">Data início</label>
                <input id="eo-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="eo-fim">Data fim</label>
                <input id="eo-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required />
              </div>
            </div>

            <p className={styles.descricaoInfo}>
              Exclui todas as ocorrências lançadas para este funcionário que colidirem com o período informado. Você poderá conferir a lista antes de confirmar.
            </p>

            <div className={styles.actions}>
              <button type="submit" className={styles.btnPrimary} disabled={loadingPreview}>
                {loadingPreview ? 'Buscando…' : 'Buscar ocorrências'}
              </button>
              <button type="button" className={styles.btnGhost} onClick={onClose} disabled={loadingPreview}>
                Cancelar
              </button>
            </div>
          </form>
        ) : preview.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>Nenhuma ocorrência encontrada nesse período.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} onClick={() => setPreview(null)}>Voltar</button>
              <button type="button" className={styles.btnGhost} onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.warnBox}>
              <AlertTriangle size={18} />
              <span>
                {preview.length} {preview.length === 1 ? 'ocorrência será excluída' : 'ocorrências serão excluídas'} — esta ação não pode ser desfeita.
              </span>
            </div>

            <ul className={styles.previewList}>
              {preview.map((o) => (
                <li key={o.id} className={styles.previewItem}>
                  <span className={styles.previewPeriodo}>{formatPeriodo(o)}</span>
                  <span className={styles.previewDescricao}>
                    {o.tipo_ocorrencia_descricao ?? '—'}
                    {o.turno && ` · ${TURNO_LABELS[o.turno]}`}
                    {o.tipo_hora && ` · ${TIPO_HORA_LABELS[o.tipo_hora]}`}
                  </span>
                </li>
              ))}
            </ul>

            <div className={styles.actions}>
              <button type="button" className={styles.btnDanger} onClick={handleConfirmar} disabled={submitting}>
                <Trash2 size={16} />
                {submitting ? 'Excluindo…' : `Excluir ${preview.length} ocorrência(s)`}
              </button>
              <button type="button" className={styles.btnGhost} onClick={() => setPreview(null)} disabled={submitting}>
                Voltar
              </button>
              <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
