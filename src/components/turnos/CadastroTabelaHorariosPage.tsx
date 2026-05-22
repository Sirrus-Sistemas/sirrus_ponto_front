import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  createTurno,
  fetchTurnos,
  fetchTurnoHorarios,
  saveTurnoHorarios,
  calcCargaDisplay,
  horaParaInput,
  updateTurno,
  type CreateTurnoPayload,
  type Turno,
  type TurnoHorarioDia,
  type TurnoTipo,
  type UpdateTurnoPayload,
} from '../../services/turnosApi'
import styles from './CadastroTabelaHorariosPage.module.css'

function podeGerirTabelaHorarios(role: string | undefined) {
  return role === 'admin'
}

const OPCOES_BATIDAS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] as const

const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function emptyHorariosDia(turno?: {
  entrada: string
  saida_intervalo?: string
  retorno_intervalo?: string
  saida: string
}): TurnoHorarioDia[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dia_semana: i,
    trabalha: i !== 0, // Dom = folga por padrão
    entrada: i !== 0 ? horaParaInput(turno?.entrada) : '',
    saida_intervalo: i !== 0 ? horaParaInput(turno?.saida_intervalo) : '',
    retorno_intervalo: i !== 0 ? horaParaInput(turno?.retorno_intervalo) : '',
    saida: i !== 0 ? horaParaInput(turno?.saida) : '',
    carga_minutos: 0,
  }))
}

const emptyForm = () => ({
  nome: '',
  entrada: '',
  saida_intervalo: '',
  retorno_intervalo: '',
  saida: '',
  tolerancia_atraso_min: '10',
  tolerancia_extra_min: '10',
  intervalo_minimo_min: '60',
  tipo: 'fixo' as TurnoTipo,
  batidas_esperadas_dia: '8',
  ativo: '1',
})

export function CadastroTabelaHorariosPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [lista, setLista] = useState<Turno[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Horários por dia ──────────────────────────────────────────────
  const [horariosDia, setHorariosDia] = useState<TurnoHorarioDia[]>([])
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [savingHorarios, setSavingHorarios] = useState(false)
  const [horarioError, setHorarioError] = useState<string | null>(null)
  const [horarioSuccess, setHorarioSuccess] = useState<string | null>(null)

  const loadLista = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoadingLista(true)
    return fetchTurnos()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => {
        if (!silent) setLoadingLista(false)
      })
  }, [])

  useEffect(() => {
    void loadLista()
  }, [loadLista])

  const update =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }

  function cancelarEdicao() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
    setHorariosDia([])
    setHorarioError(null)
    setHorarioSuccess(null)
  }

  function iniciarEdicao(t: Turno) {
    setEditingId(t.id)
    setForm({
      nome: t.nome,
      entrada: horaParaInput(t.entrada),
      saida_intervalo: horaParaInput(t.saida_intervalo),
      retorno_intervalo: horaParaInput(t.retorno_intervalo),
      saida: horaParaInput(t.saida),
      tolerancia_atraso_min: String(t.tolerancia_atraso_min ?? 10),
      tolerancia_extra_min: String(t.tolerancia_extra_min ?? 10),
      intervalo_minimo_min: String(t.intervalo_minimo_min ?? 60),
      tipo: (t.tipo ?? 'fixo') as TurnoTipo,
      batidas_esperadas_dia: String(t.batidas_esperadas_dia ?? 8),
      ativo: String(t.ativo ?? 1),
    })
    setError(null)
    setSuccess(null)
    setHorarioError(null)
    setHorarioSuccess(null)
  }

  // Load per-day hours when a turno is selected for editing
  useEffect(() => {
    if (editingId == null) { setHorariosDia([]); return }
    setLoadingHorarios(true)
    const turno = lista.find((t) => t.id === editingId)
    fetchTurnoHorarios(editingId)
      .then((rows) => {
        if (rows.length === 0) {
          // No saved rows yet — seed from the turno's default times
          setHorariosDia(emptyHorariosDia(turno))
        } else {
          // Merge saved rows into a full 7-day array
          const base = emptyHorariosDia(turno)
          for (const r of rows) {
            base[r.dia_semana] = r
          }
          setHorariosDia(base)
        }
      })
      .catch(() => setHorariosDia(emptyHorariosDia(turno)))
      .finally(() => setLoadingHorarios(false))
  }, [editingId, lista])

  function updateHorarioDia(
    diaIndex: number,
    field: keyof TurnoHorarioDia,
    value: string | boolean,
  ) {
    setHorariosDia((prev) =>
      prev.map((d) => (d.dia_semana === diaIndex ? { ...d, [field]: value } : d)),
    )
  }

  async function salvarHorarios() {
    if (editingId == null) return
    setSavingHorarios(true)
    setHorarioError(null)
    setHorarioSuccess(null)
    try {
      await saveTurnoHorarios(editingId, horariosDia)
      setHorarioSuccess('Horários por dia salvos com sucesso.')
    } catch (e) {
      setHorarioError(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    } finally {
      setSavingHorarios(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const nome = form.nome.trim()
    if (nome.length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.')
      return
    }
    const times = [form.entrada, form.saida_intervalo, form.retorno_intervalo, form.saida] as const
    const reHhMm = /^\d{2}:\d{2}$/
    for (const t of times) {
      if (!t || !reHhMm.test(t)) {
        setError('Preencha entrada, saída para intervalo, retorno do intervalo e saída no formato HH:MM.')
        return
      }
    }

    const parseMin = (v: string, def: number) => { const n = parseInt(v, 10); return Number.isNaN(n) ? def : Math.max(0, n); }
    const tolerA = parseMin(form.tolerancia_atraso_min, 10)
    const tolerE = parseMin(form.tolerancia_extra_min,  10)
    const intMin = parseMin(form.intervalo_minimo_min,  60)
    const batidas = parseInt(form.batidas_esperadas_dia, 10)
    if (!Number.isFinite(batidas) || batidas < 2 || batidas > 24 || batidas % 2 !== 0) {
      setError('Batidas por dia deve ser um número par entre 2 e 24.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
        const payload: UpdateTurnoPayload = {
          nome,
          entrada: form.entrada,
          saida_intervalo: form.saida_intervalo,
          retorno_intervalo: form.retorno_intervalo,
          saida: form.saida,
          tolerancia_atraso_min: tolerA,
          tolerancia_extra_min: tolerE,
          intervalo_minimo_min: intMin,
          tipo: form.tipo,
          batidas_esperadas_dia: batidas,
          ativo: form.ativo === '0' ? 0 : 1,
        }
        await updateTurno(editingId, payload)
        setSuccess('Horário atualizado com sucesso.')
        cancelarEdicao()
      } else {
        const payload: CreateTurnoPayload = {
          nome,
          entrada: form.entrada,
          saida_intervalo: form.saida_intervalo,
          retorno_intervalo: form.retorno_intervalo,
          saida: form.saida,
          tolerancia_atraso_min: tolerA,
          tolerancia_extra_min: tolerE,
          intervalo_minimo_min: intMin,
          tipo: form.tipo,
          batidas_esperadas_dia: batidas,
        }
        await createTurno(payload)
        setSuccess('Tabela de horários cadastrada com sucesso.')
        setForm(emptyForm())
      }
      await loadLista({ silent: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!meReady) {
    return <p className={styles.loading}>Carregando…</p>
  }

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p>Verifique a conexão com o servidor e se o token ainda é válido. Recarregue a página ou faça login de novo.</p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </p>
      </div>
    )
  }

  if (!podeGerirTabelaHorarios(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>
          Apenas administradores podem cadastrar tabelas de horários. Se precisar de um novo turno, fale com o RH ou
          TI.
        </p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Tabela de horários</h1>
      <p className={styles.subtitle}>
        Cadastre turnos com horário de entrada, intervalo e saída. Defina quantas <strong>batidas por dia</strong> cada
        turno exige (par, ex.: 4 ou 6): o espelho e o dashboard do funcionário seguem esse número conforme o turno
        vinculado a ele.
      </p>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{editingId != null ? 'Editar horário' : 'Novo horário'}</h2>
        {editingId != null ? (
          <p className={styles.hint} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Alterando registro #{editingId}.{' '}
            <button type="button" className={styles.btnLink} onClick={cancelarEdicao}>
              Cancelar edição
            </button>
          </p>
        ) : null}

        {error ? (
          <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {success}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="th-nome">Nome do turno</label>
              <input id="th-nome" name="nome" value={form.nome} onChange={update('nome')} autoComplete="off" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-entrada">Entrada</label>
              <input id="th-entrada" name="entrada" type="time" value={form.entrada} onChange={update('entrada')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-saida-int">Saída para intervalo</label>
              <input
                id="th-saida-int"
                name="saida_intervalo"
                type="time"
                value={form.saida_intervalo}
                onChange={update('saida_intervalo')}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-retorno">Retorno do intervalo</label>
              <input
                id="th-retorno"
                name="retorno_intervalo"
                type="time"
                value={form.retorno_intervalo}
                onChange={update('retorno_intervalo')}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-saida">Saída</label>
              <input id="th-saida" name="saida" type="time" value={form.saida} onChange={update('saida')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-tipo">Tipo</label>
              <select id="th-tipo" name="tipo" value={form.tipo} onChange={update('tipo')}>
                <option value="fixo">Fixo</option>
                <option value="flexivel">Flexível</option>
                <option value="escala">Escala</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="th-batidas">Batidas por dia útil</label>
              <select
                id="th-batidas"
                name="batidas_esperadas_dia"
                value={form.batidas_esperadas_dia}
                onChange={update('batidas_esperadas_dia')}
              >
                {OPCOES_BATIDAS.map((v) => (
                  <option key={v} value={String(v)}>
                    {v} batidas
                  </option>
                ))}
              </select>
              <p className={styles.hint}>Número par; define o ciclo completo no espelho (ex.: 4 ou 6 conforme a jornada).</p>
            </div>
            <div className={styles.field}>
              <label htmlFor="th-tol-at">Tolerância atraso (min)</label>
              <input
                id="th-tol-at"
                name="tolerancia_atraso_min"
                type="number"
                min={0}
                value={form.tolerancia_atraso_min}
                onChange={update('tolerancia_atraso_min')}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-tol-ex">Tolerância extra (min)</label>
              <input
                id="th-tol-ex"
                name="tolerancia_extra_min"
                type="number"
                min={0}
                value={form.tolerancia_extra_min}
                onChange={update('tolerancia_extra_min')}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="th-int-min">Intervalo mínimo (min)</label>
              <input
                id="th-int-min"
                name="intervalo_minimo_min"
                type="number"
                min={0}
                value={form.intervalo_minimo_min}
                onChange={update('intervalo_minimo_min')}
              />
            </div>
            {editingId != null ? (
              <div className={styles.field}>
                <label htmlFor="th-ativo">Situação</label>
                <select id="th-ativo" name="ativo" value={form.ativo} onChange={update('ativo')}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </div>
            ) : null}
          </div>
          <p className={styles.hint} style={{ marginTop: '0.75rem' }}>
            Os horários são enviados ao servidor como HH:MM (mesmo formato exigido pela API).
          </p>
          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar horário'}
            </button>
            {editingId != null ? (
              <button type="button" className={styles.btnGhost} onClick={cancelarEdicao} disabled={submitting}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {editingId != null ? (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Horários por dia da semana</h2>
          <p className={styles.hint} style={{ marginBottom: '1rem' }}>
            Configure horário e carga de cada dia. Dias marcados como <strong>Folga</strong> não geram débito no espelho.
            Se não quiser intervalo num dia (ex.: sábado), deixe os campos de intervalo em branco.
          </p>

          {horarioError ? (
            <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{horarioError}</p>
          ) : null}
          {horarioSuccess ? (
            <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{horarioSuccess}</p>
          ) : null}

          {loadingHorarios ? (
            <p className={styles.loading}>Carregando horários…</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Trabalha</th>
                    <th>Entrada</th>
                    <th>Saída int.</th>
                    <th>Retorno</th>
                    <th>Saída</th>
                    <th>Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {horariosDia.map((d) => (
                    <tr key={d.dia_semana} className={!d.trabalha ? styles.rowFolga : undefined}>
                      <td className={styles.tdDia}>{DIAS_LABEL[d.dia_semana]}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={d.trabalha}
                          onChange={(e) => updateHorarioDia(d.dia_semana, 'trabalha', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={d.entrada}
                          disabled={!d.trabalha}
                          onChange={(e) => updateHorarioDia(d.dia_semana, 'entrada', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={d.saida_intervalo}
                          disabled={!d.trabalha}
                          onChange={(e) => updateHorarioDia(d.dia_semana, 'saida_intervalo', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={d.retorno_intervalo}
                          disabled={!d.trabalha}
                          onChange={(e) => updateHorarioDia(d.dia_semana, 'retorno_intervalo', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={d.saida}
                          disabled={!d.trabalha}
                          onChange={(e) => updateHorarioDia(d.dia_semana, 'saida', e.target.value)}
                        />
                      </td>
                      <td className={styles.tdCarga}>{calcCargaDisplay(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.actions} style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={savingHorarios || loadingHorarios}
              onClick={() => void salvarHorarios()}
            >
              {savingHorarios ? 'Salvando…' : 'Salvar horários por dia'}
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Horários cadastrados</h2>
        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <>
            <p className={styles.hint} style={{ marginBottom: '0.75rem' }}>
              A lista mostra apenas turnos <strong>ativos</strong> (o servidor filtra os inativos). Ao desativar um
              horário, ele deixa de aparecer aqui e nos selects de cadastro de funcionário.
            </p>
            <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Entrada</th>
                  <th>Saída int.</th>
                  <th>Retorno</th>
                  <th>Saída</th>
                  <th>Tipo</th>
                  <th>Bat./dia</th>
                  <th>Colaboradores</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={10}>Nenhum turno cadastrado ainda.</td>
                  </tr>
                ) : (
                  lista.map((t) => (
                    <tr key={t.id}>
                      <td>{t.nome}</td>
                      <td>{horaParaInput(t.entrada)}</td>
                      <td>{horaParaInput(t.saida_intervalo)}</td>
                      <td>{horaParaInput(t.retorno_intervalo)}</td>
                      <td>{horaParaInput(t.saida)}</td>
                      <td>
                        <span className={styles.badge}>{t.tipo ?? 'fixo'}</span>
                      </td>
                      <td>{t.batidas_esperadas_dia ?? 8}</td>
                      <td>{t.total_funcionarios ?? 0}</td>
                      <td>
                        {t.ativo === 0 ? (
                          <span className={`${styles.badge} ${styles.badgeOff}`}>Inativo</span>
                        ) : (
                          <span className={styles.badge}>Ativo</span>
                        )}
                      </td>
                      <td>
                        <button type="button" className={styles.btnLink} onClick={() => iniciarEdicao(t)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
