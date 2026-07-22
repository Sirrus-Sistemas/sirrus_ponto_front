import { type FormEvent, useState } from 'react';
import { CalendarCheck, X } from 'lucide-react';
import { ApiError } from '../../../../lib/api';
import type { HorariosManuais, JustificarPeriodoResultado } from '../../../../services/fichaPontoApi';
import styles from './JustificarPeriodoModal.module.css';

type Modo = 'automatico' | 'manual';

const SLOTS: { campo: keyof HorariosManuais; label: string }[] = [
  { campo: 'entrada1', label: 'E1' },
  { campo: 'saida1', label: 'S1' },
  { campo: 'entrada2', label: 'E2' },
  { campo: 'saida2', label: 'S2' },
  { campo: 'entrada3', label: 'E3' },
  { campo: 'saida3', label: 'S3' },
  { campo: 'entrada4', label: 'E4' },
  { campo: 'saida4', label: 'S4' },
];

interface Props {
  funcionarioId: number;
  funcionarioNome: string;
  defaultDataInicio: string;
  defaultDataFim: string;
  onClose: () => void;
  onJustificar: (params: {
    funcionario_id: number;
    data_inicio: string;
    data_fim: string;
    modo: Modo;
    horarios?: HorariosManuais;
    justificativa: string;
  }) => Promise<JustificarPeriodoResultado>;
}

export function JustificarPeriodoModal({
  funcionarioId,
  funcionarioNome,
  defaultDataInicio,
  defaultDataFim,
  onClose,
  onJustificar,
}: Props) {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [modo, setModo] = useState<Modo>('automatico');
  const [horarios, setHorarios] = useState<HorariosManuais>({});
  const [justificativa, setJustificativa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<JustificarPeriodoResultado | null>(null);

  function setHorario(campo: keyof HorariosManuais, value: string) {
    setHorarios((prev) => ({ ...prev, [campo]: value || undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!dataInicio) { setError('Informe a data início.'); return; }
    if (!dataFim) { setError('Informe a data fim.'); return; }
    if (dataFim < dataInicio) { setError('Data fim deve ser igual ou posterior à data início.'); return; }
    if (!justificativa.trim()) { setError('Informe a justificativa.'); return; }
    if (modo === 'manual' && !Object.values(horarios).some(Boolean)) {
      setError('Informe ao menos um horário.');
      return;
    }

    setSubmitting(true);
    try {
      const r = await onJustificar({
        funcionario_id: funcionarioId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        modo,
        horarios: modo === 'manual' ? horarios : undefined,
        justificativa: justificativa.trim(),
      });
      setResultado(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível justificar o período.');
    } finally {
      setSubmitting(false);
    }
  }

  if (resultado) {
    return (
      <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Justificar Período</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>
          <div className={styles.successBox}>
            <CalendarCheck size={32} className={styles.successIcon} />
            <p className={styles.successTitle}>
              {resultado.dias_lancados} {resultado.dias_lancados === 1 ? 'dia lançado' : 'dias lançados'}!
            </p>
            <p className={styles.successSub}>
              <strong>{resultado.total_batidas}</strong> {resultado.total_batidas === 1 ? 'batida lançada' : 'batidas lançadas'} para {funcionarioNome}.
            </p>
            {(resultado.dias_ja_completos > 0 || resultado.dias_ignorados_bloqueado > 0 || resultado.dias_ignorados_sem_expediente > 0) && (
              <p className={styles.successDetails}>
                {resultado.dias_ja_completos > 0 && <span>{resultado.dias_ja_completos} dia(s) já estavam completos.</span>}
                {resultado.dias_ignorados_sem_expediente > 0 && <span>{resultado.dias_ignorados_sem_expediente} dia(s) sem expediente previsto (ignorados).</span>}
                {resultado.dias_ignorados_bloqueado > 0 && <span>{resultado.dias_ignorados_bloqueado} dia(s) bloqueados (ignorados).</span>}
              </p>
            )}
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
          <h2 className={styles.modalTitle}>Justificar Período</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>

        <div className={styles.funcRow}>
          <span className={styles.funcLabel}>Funcionário</span>
          <span className={styles.funcName}>{funcionarioNome}</span>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="jp-inicio">Data início</label>
              <input id="jp-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="jp-fim">Data fim</label>
              <input id="jp-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required />
            </div>
          </div>

          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.modeBtn} ${modo === 'automatico' ? styles.modeBtnActive : ''}`}
              onClick={() => setModo('automatico')}
            >
              Horário automático
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${modo === 'manual' ? styles.modeBtnActive : ''}`}
              onClick={() => setModo('manual')}
            >
              Horário manual
            </button>
          </div>

          {modo === 'automatico' ? (
            <p className={styles.descricaoInfo}>
              Preenche pelos horários da escala ou turno do funcionário em cada dia do período, pulando dias de folga e horários que já têm batida.
            </p>
          ) : (
            <>
              <span className={styles.fieldsetLabel}>Horários (aplicados nos dias com expediente previsto, pulando folgas)</span>
              <div className={styles.horariosGrid}>
                {SLOTS.map(({ campo, label }) => (
                  <div className={styles.field} key={campo}>
                    <label htmlFor={`jp-${campo}`}>{label}</label>
                    <input
                      id={`jp-${campo}`}
                      type="time"
                      value={horarios[campo] ?? ''}
                      onChange={(e) => setHorario(campo, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.field} style={{ marginBottom: '1rem' }}>
            <label htmlFor="jp-justificativa">Justificativa</label>
            <textarea
              id="jp-justificativa"
              placeholder="Descreva o motivo…"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              maxLength={500}
              required
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Lançando…' : 'Justificar período'}
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
