import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import {
  fetchTiposOcorrencia,
  TURNO_LABELS,
  TIPO_HORA_LABELS,
  type TipoHora,
  type TipoOcorrencia,
  type TurnoOcorrencia,
} from '../../services/ocorrenciasApi'
import { aprovarOcorrenciaMobile, abrirAnexoOcorrenciaMobile, type OcorrenciaPendente } from '../../services/ocorrenciasMobileApi'
import styles from './AprovarOcorrenciaModal.module.css'

interface AprovarOcorrenciaModalProps {
  item: OcorrenciaPendente
  onClose: () => void
  onSuccess: () => void
}

/** "HH:MM" → horas decimais (2 casas, mesma precisão do DECIMAL(5,2) da coluna quantidade_horas). */
function hhmmParaDecimal(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return Math.round(((h * 60 + m) / 60) * 100) / 100
}

export function AprovarOcorrenciaModal({ item, onClose, onSuccess }: AprovarOcorrenciaModalProps) {
  const [tipos, setTipos] = useState<TipoOcorrencia[]>([])
  const [tipoOcorrenciaId, setTipoOcorrenciaId] = useState('')
  const [turno, setTurno] = useState<TurnoOcorrencia>(item.turno)
  const [tipoHora, setTipoHora] = useState<TipoHora>('hora_50_60')
  const [temQuantidade, setTemQuantidade] = useState(false)
  const [quantidadeHorasHhmm, setQuantidadeHorasHhmm] = useState('')
  const [informativa, setInformativa] = useState(false)
  const [descricao, setDescricao] = useState(
    [item.motivo_label, item.justificativa].filter(Boolean).join(' — ').slice(0, 255),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTiposOcorrencia()
      .then((data) => setTipos(data.filter((t) => t.ativo === 1)))
      .catch(() => {})
  }, [])

  const handleAbrirAnexo = useCallback(() => {
    abrirAnexoOcorrenciaMobile(item.mobile_id).catch((e) => {
      setError(e instanceof ApiError ? e.message : 'Não foi possível abrir o anexo.')
    })
  }, [item.mobile_id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!tipoOcorrenciaId) { setError('Selecione um tipo de ocorrência.'); return }
    if (temQuantidade && !quantidadeHorasHhmm) { setError('Informe a quantidade de horas.'); return }

    setSubmitting(true)
    try {
      await aprovarOcorrenciaMobile(item.mobile_id, {
        funcionario_id: item.funcionario_id,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        tipo_ocorrencia_id: Number(tipoOcorrenciaId),
        turno,
        tipo_hora: tipoHora,
        quantidade_horas: temQuantidade && quantidadeHorasHhmm ? hhmmParaDecimal(quantidadeHorasHhmm) : null,
        informativa: informativa ? 1 : 0,
        descricao: descricao || null,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aprovar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Aprovar Ocorrência</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.funcRow}>
          <span className={styles.funcLabel}>Funcionário</span>
          <span className={styles.funcName}>{item.funcionario_nome}</span>
        </div>

        <div className={styles.origemBox}>
          <strong>Enviado pelo app:</strong> {item.motivo_label ?? 'sem motivo informado'}
          {item.justificativa ? ` — "${item.justificativa}"` : ''}
          {' '}({item.data_inicio === item.data_fim ? item.data_inicio : `${item.data_inicio} a ${item.data_fim}`})
        </div>

        {item.tem_anexo && (
          <button type="button" className={styles.anexoLink} onClick={handleAbrirAnexo}>
            Ver anexo enviado
          </button>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid3}>
            <div className={styles.field}>
              <label htmlFor="aom-tipo">Tipo de ocorrência</label>
              <select
                id="aom-tipo"
                value={tipoOcorrenciaId}
                onChange={(e) => setTipoOcorrenciaId(e.target.value)}
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
              <label htmlFor="aom-turno">Turno</label>
              <select
                id="aom-turno"
                value={turno}
                onChange={(e) => setTurno(e.target.value as TurnoOcorrencia)}
              >
                {(Object.entries(TURNO_LABELS) as [TurnoOcorrencia, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="aom-tipohora">Tipo de hora</label>
              <select
                id="aom-tipohora"
                value={tipoHora}
                onChange={(e) => setTipoHora(e.target.value as TipoHora)}
              >
                {(Object.entries(TIPO_HORA_LABELS) as [TipoHora, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.checkRow}>
            <input
              id="aom-tem-qtd"
              type="checkbox"
              checked={temQuantidade}
              onChange={(e) => setTemQuantidade(e.target.checked)}
            />
            <label htmlFor="aom-tem-qtd">Especificar quantidade de horas</label>
            {temQuantidade && (
              <input
                id="aom-qtd-horas"
                type="time"
                className={styles.horasInput}
                value={quantidadeHorasHhmm}
                onChange={(e) => setQuantidadeHorasHhmm(e.target.value)}
              />
            )}
          </div>

          <div className={styles.checkRow}>
            <input
              id="aom-informativa"
              type="checkbox"
              checked={informativa}
              onChange={(e) => setInformativa(e.target.checked)}
            />
            <label
              htmlFor="aom-informativa"
              title="Crédito no dia inteiro sem batidas (férias, atestado…) abona o dia mesmo marcado como informativa."
            >
              Informativa (não soma nem subtrai horas)
            </label>
          </div>

          <div className={styles.field}>
            <label htmlFor="aom-obs">Descrição</label>
            <textarea
              id="aom-obs"
              placeholder="Detalhes sobre a ocorrência…"
              value={descricao}
              maxLength={255}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Aprovando…' : 'Aprovar e lançar'}
            </button>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
