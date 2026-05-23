import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { DatePicker } from '../../../../components/ui/DatePicker';
import { ApiError } from '../../../../lib/api';
import {
  createOcorrencia,
  fetchTiposOcorrencia,
  TURNO_LABELS,
  TIPO_HORA_LABELS,
  type TipoHora,
  type TipoOcorrencia,
  type TurnoOcorrencia,
} from '../../../../services/ocorrenciasApi';
import styles from './OcorrenciaModal.module.css';

interface OcorrenciaModalProps {
  funcionarioId: number;
  funcionarioNome: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  onClose: () => void;
  onSuccess: () => void;
}

const emptyForm = (dataInicio: string, dataFim: string) => ({
  data_inicio: dataInicio,
  data_fim: dataFim,
  tipo_ocorrencia_id: '',
  turno: 'integral' as TurnoOcorrencia,
  tipo_hora: 'hora_50_60' as TipoHora,
  tem_quantidade: false,
  quantidade_horas: '',
  descricao: '',
});

export function OcorrenciaModal({
  funcionarioId,
  funcionarioNome,
  dataInicio,
  dataFim,
  onClose,
  onSuccess,
}: OcorrenciaModalProps) {
  const [tipos, setTipos] = useState<TipoOcorrencia[]>([]);
  const [form, setForm] = useState(() => emptyForm(dataInicio, dataFim));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTiposOcorrencia()
      .then((data) => setTipos(data.filter((t) => t.ativo === 1)))
      .catch(() => {});
  }, []);

  const setField = useCallback(<K extends keyof ReturnType<typeof emptyForm>>(
    field: K,
    value: ReturnType<typeof emptyForm>[K],
  ) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.data_inicio) { setError('Informe a data inicial.'); return; }
    if (!form.data_fim)    { setError('Informe a data final.'); return; }
    if (form.data_fim < form.data_inicio) { setError('Data final não pode ser anterior à data inicial.'); return; }
    if (!form.tipo_ocorrencia_id) { setError('Selecione um tipo de ocorrência.'); return; }
    if (form.tem_quantidade && !form.quantidade_horas) { setError('Informe a quantidade de horas.'); return; }

    setSubmitting(true);
    try {
      await createOcorrencia({
        funcionario_id: funcionarioId,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        tipo_ocorrencia_id: Number(form.tipo_ocorrencia_id),
        turno: form.turno,
        tipo_hora: form.tipo_hora,
        quantidade_horas: form.tem_quantidade && form.quantidade_horas
          ? Number(form.quantidade_horas)
          : null,
        descricao: form.descricao || null,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível lançar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nova Ocorrência</h2>
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
              <label htmlFor="om-inicio">Data inicial</label>
              <DatePicker
                id="om-inicio"
                value={form.data_inicio}
                onChange={(e) => setField('data_inicio', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="om-fim">Data final</label>
              <DatePicker
                id="om-fim"
                value={form.data_fim}
                onChange={(e) => setField('data_fim', e.target.value)}
              />
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.field}>
              <label htmlFor="om-tipo">Tipo de ocorrência</label>
              <select
                id="om-tipo"
                value={form.tipo_ocorrencia_id}
                onChange={(e) => setField('tipo_ocorrencia_id', e.target.value)}
              >
                <option value="">Selecione…</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descricao} ({t.tipo_lancamento === 'credito' ? 'Crédito' : 'Débito'})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="om-turno">Turno</label>
              <select
                id="om-turno"
                value={form.turno}
                onChange={(e) => setField('turno', e.target.value as TurnoOcorrencia)}
              >
                {(Object.entries(TURNO_LABELS) as [TurnoOcorrencia, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="om-tipohora">Tipo de hora</label>
              <select
                id="om-tipohora"
                value={form.tipo_hora}
                onChange={(e) => setField('tipo_hora', e.target.value as TipoHora)}
              >
                {(Object.entries(TIPO_HORA_LABELS) as [TipoHora, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.checkRow}>
            <input
              id="om-tem-qtd"
              type="checkbox"
              checked={form.tem_quantidade}
              onChange={(e) => setField('tem_quantidade', e.target.checked)}
            />
            <label htmlFor="om-tem-qtd">Especificar quantidade de horas</label>
            {form.tem_quantidade && (
              <input
                type="number"
                className={styles.horasInput}
                min="0.25"
                max="24"
                step="0.25"
                placeholder="Ex: 2.5"
                value={form.quantidade_horas}
                onChange={(e) => setField('quantidade_horas', e.target.value)}
              />
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="om-obs">Observação (opcional)</label>
            <textarea
              id="om-obs"
              placeholder="Detalhes adicionais sobre a ocorrência…"
              value={form.descricao}
              onChange={(e) => setField('descricao', e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : 'Lançar ocorrência'}
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
