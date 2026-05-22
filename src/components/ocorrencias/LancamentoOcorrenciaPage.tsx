import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { DatePicker } from '../ui/DatePicker'
import { MonthPicker } from '../ui/MonthPicker'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import {
  createOcorrencia,
  deleteOcorrencia,
  fetchOcorrencias,
  fetchTiposOcorrencia,
  TURNO_LABELS,
  TIPO_HORA_LABELS,
  type Ocorrencia,
  type TipoHora,
  type TipoOcorrencia,
  type TurnoOcorrencia,
} from '../../services/ocorrenciasApi'
import styles from './Ocorrencias.module.css'

const now = new Date()
const nowMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const emptyForm = () => ({
  funcionario_id: '',
  mes_ano: nowMesAno,
  data_inicio: '',
  data_fim: '',
  tipo_ocorrencia_id: '',
  turno: 'integral' as TurnoOcorrencia,
  tipo_hora: 'hora_50_60' as TipoHora,
  tem_quantidade: false,
  quantidade_horas: '',
  descricao: '',
})

function fmtDate(iso: string): string {
  if (!iso) return ''
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function fmtMesAno(mesAno: string): string {
  if (!mesAno) return ''
  const [y, m] = mesAno.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function LancamentoOcorrenciaPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])
  const [tipos, setTipos] = useState<TipoOcorrencia[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingOcorr, setLoadingOcorr] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load initial data (employees + tipos)
  useEffect(() => {
    Promise.all([
      fetchFuncionarios({ limit: 500, ativo: 1 }),
      fetchTiposOcorrencia(),
    ])
      .then(([funcs, tiposData]) => {
        setFuncionarios(funcs.data)
        setTipos(tiposData.filter((t) => t.ativo === 1))
      })
      .catch(() => {/* silent */})
      .finally(() => setLoadingInit(false))
  }, [])

  const loadOcorrencias = useCallback((funcId?: number, mesAno?: string) => {
    if (!funcId || !mesAno) { setOcorrencias([]); return }
    const [ano, mes] = mesAno.split('-').map(Number)
    setLoadingOcorr(true)
    fetchOcorrencias({ funcionario_id: funcId, ano, mes })
      .then(setOcorrencias)
      .catch(() => setOcorrencias([]))
      .finally(() => setLoadingOcorr(false))
  }, [])

  // Reload list when funcionario or mes_ano changes
  useEffect(() => {
    const fId = form.funcionario_id ? Number(form.funcionario_id) : undefined
    loadOcorrencias(fId, form.mes_ano)
  }, [form.funcionario_id, form.mes_ano, loadOcorrencias])

  function setField<K extends keyof ReturnType<typeof emptyForm>>(
    field: K,
    value: ReturnType<typeof emptyForm>[K]
  ) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // When funcionario changes, default data_inicio / data_fim to first/last day of mes_ano
  function handleFuncChange(id: string) {
    setField('funcionario_id', id)
    if (id && form.mes_ano) {
      const [y, m] = form.mes_ano.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const pad = (n: number) => String(n).padStart(2, '0')
      setForm((f) => ({
        ...f,
        funcionario_id: id,
        data_inicio: `${y}-${pad(m)}-01`,
        data_fim: `${y}-${pad(m)}-${pad(lastDay)}`,
      }))
    }
  }

  function handleMesAnoChange(v: string) {
    setField('mes_ano', v)
    if (v && form.funcionario_id) {
      const [y, m] = v.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const pad = (n: number) => String(n).padStart(2, '0')
      setForm((f) => ({
        ...f,
        mes_ano: v,
        data_inicio: `${y}-${pad(m)}-01`,
        data_fim: `${y}-${pad(m)}-${pad(lastDay)}`,
      }))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.funcionario_id) { setError('Selecione um funcionário.'); return }
    if (!form.data_inicio)    { setError('Informe a data inicial.'); return }
    if (!form.data_fim)       { setError('Informe a data final.'); return }
    if (form.data_fim < form.data_inicio) { setError('Data final não pode ser anterior à data inicial.'); return }
    if (!form.tipo_ocorrencia_id) { setError('Selecione um tipo de ocorrência.'); return }
    if (form.tem_quantidade && !form.quantidade_horas) { setError('Informe a quantidade de horas.'); return }

    setSubmitting(true)
    try {
      await createOcorrencia({
        funcionario_id: Number(form.funcionario_id),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        tipo_ocorrencia_id: Number(form.tipo_ocorrencia_id),
        turno: form.turno,
        tipo_hora: form.tipo_hora,
        quantidade_horas: form.tem_quantidade && form.quantidade_horas
          ? Number(form.quantidade_horas)
          : null,
        descricao: form.descricao || null,
      })
      setSuccess('Ocorrência lançada com sucesso.')
      setForm((f) => ({ ...emptyForm(), funcionario_id: f.funcionario_id, mes_ano: f.mes_ano }))
      loadOcorrencias(Number(form.funcionario_id), form.mes_ano)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível lançar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta ocorrência?')) return
    try {
      await deleteOcorrencia(id)
      const fId = form.funcionario_id ? Number(form.funcionario_id) : undefined
      loadOcorrencias(fId, form.mes_ano)
    } catch {
      setError('Não foi possível excluir.')
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  if (me.role !== 'admin' && me.role !== 'gestor') {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores e gestores podem lançar ocorrências.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  if (loadingInit) return <p className={styles.loading}>Carregando dados…</p>

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Lançamento de Ocorrências</h1>
      <p className={styles.subtitle}>
        Registre justificativas, atestados, abonos e outras ocorrências nos registros dos funcionários.
      </p>

      {/* ─── FORMULÁRIO ─────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Nova ocorrência</h2>

        {error ? <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p> : null}
        {success ? <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{success}</p> : null}

        <form onSubmit={handleSubmit} noValidate>

          {/* Funcionário + Mês/Ano */}
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="oc-func">Funcionário</label>
              <select
                id="oc-func"
                value={form.funcionario_id}
                onChange={(e) => handleFuncChange(e.target.value)}
              >
                <option value="">Selecione…</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="oc-mesano">Mês / Ano</label>
              <MonthPicker
                id="oc-mesano"
                value={form.mes_ano}
                onChange={(e) => handleMesAnoChange(e.target.value)}
              />
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Datas */}
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="oc-inicio">Data inicial</label>
              <DatePicker
                id="oc-inicio"
                value={form.data_inicio}
                onChange={(e) => setField('data_inicio', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="oc-fim">Data final</label>
              <DatePicker
                id="oc-fim"
                value={form.data_fim}
                onChange={(e) => setField('data_fim', e.target.value)}
              />
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Tipo de ocorrência + Turno + Tipo hora */}
          <div className={styles.grid3}>
            <div className={styles.field}>
              <label htmlFor="oc-tipo">Tipo de ocorrência</label>
              <select
                id="oc-tipo"
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
              <label htmlFor="oc-turno">Turno</label>
              <select
                id="oc-turno"
                value={form.turno}
                onChange={(e) => setField('turno', e.target.value as TurnoOcorrencia)}
              >
                {(Object.entries(TURNO_LABELS) as [TurnoOcorrencia, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="oc-tipohora">Tipo de hora</label>
              <select
                id="oc-tipohora"
                value={form.tipo_hora}
                onChange={(e) => setField('tipo_hora', e.target.value as TipoHora)}
              >
                {(Object.entries(TIPO_HORA_LABELS) as [TipoHora, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Quantidade de horas (opcional) */}
          <div className={styles.checkRow} style={{ marginBottom: '0.75rem' }}>
            <input
              id="oc-tem-qtd"
              type="checkbox"
              checked={form.tem_quantidade}
              onChange={(e) => setField('tem_quantidade', e.target.checked)}
            />
            <label htmlFor="oc-tem-qtd">Especificar quantidade de horas</label>
            {form.tem_quantidade ? (
              <div className={styles.horasInline}>
                <input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  placeholder="Ex: 2.5"
                  value={form.quantidade_horas}
                  onChange={(e) => setField('quantidade_horas', e.target.value)}
                />
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>horas</span>
              </div>
            ) : null}
          </div>

          {/* Observação */}
          <div className={styles.field}>
            <label htmlFor="oc-obs">Observação (opcional)</label>
            <textarea
              id="oc-obs"
              placeholder="Detalhes adicionais sobre a ocorrência…"
              value={form.descricao}
              onChange={(e) => setField('descricao', e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : 'Lançar ocorrência'}
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setForm(emptyForm())}
              disabled={submitting}
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      {/* ─── LISTA DO MÊS ───────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          Ocorrências lançadas
          {form.funcionario_id && form.mes_ano
            ? ` — ${fmtMesAno(form.mes_ano)}`
            : ''}
        </h2>

        {!form.funcionario_id ? (
          <p className={styles.hint}>Selecione um funcionário para visualizar as ocorrências.</p>
        ) : loadingOcorr ? (
          <p className={styles.loading}>Carregando…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Período</th>
                  <th>Tipo</th>
                  <th>Turno</th>
                  <th>Tipo hora</th>
                  <th>Qtd. horas</th>
                  <th>Observação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ocorrencias.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={8}>Nenhuma ocorrência neste período.</td>
                  </tr>
                ) : (
                  ocorrencias.map((o) => (
                    <tr key={o.id}>
                      <td>{o.funcionario_nome}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {fmtDate(o.data_inicio)}
                        {o.data_fim !== o.data_inicio ? ` → ${fmtDate(o.data_fim)}` : ''}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${o.tipo_lancamento === 'credito' ? styles.badgeCredito : styles.badgeDebito}`}>
                          {o.tipo_ocorrencia_descricao ?? o.tipo}
                        </span>
                      </td>
                      <td>{o.turno ? TURNO_LABELS[o.turno] : '—'}</td>
                      <td>{o.tipo_hora ? TIPO_HORA_LABELS[o.tipo_hora] : '—'}</td>
                      <td>{o.quantidade_horas != null ? `${o.quantidade_horas}h` : '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.descricao || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => void handleDelete(o.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
