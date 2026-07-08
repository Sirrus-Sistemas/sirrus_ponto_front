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

const OPCOES_BATIDAS = [2, 4, 6, 8] as const

const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function tipoLabel(tipo: string | undefined) {
  const map: Record<string, string> = { fixo: 'Fixo', flexivel: 'Flexível', escala: 'Escala' }
  return map[tipo ?? 'fixo'] ?? tipo ?? 'Fixo'
}

function toMinutes(hhmm: string): number {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return -1
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Label de cada campo de horário conforme posição e total de batidas */
function labelBatida(i: number, total: number): string {
  if (i === 0) return 'ENTRADA'
  if (i === total - 1) return 'SAÍDA'
  const n = Math.ceil(i / 2)
  return i % 2 === 1 ? `SAÍDA INT. ${n}` : `RETORNO ${n}`
}

/** Monta array de horários a partir dos campos do turno */
function batidaTimesFromTurno(t: Turno): string[] {
  const n = t.batidas_esperadas_dia ?? 4

  // Coluna JSON tem o array completo (suporta > 4 batidas)
  if (t.batida_times_json) {
    try {
      const parsed: unknown = JSON.parse(t.batida_times_json)
      if (Array.isArray(parsed) && parsed.length === n) {
        return (parsed as unknown[]).map((v) => (typeof v === 'string' ? v : ''))
      }
    } catch { /* fall through */ }
  }

  // Fallback legado: 4 colunas — coloca entrada, intervalo e saída nas posições corretas
  const arr: string[] = Array.from({ length: n }, () => '')
  arr[0] = horaParaInput(t.entrada)
  if (n >= 4) {
    arr[1] = horaParaInput(t.saida_intervalo)
    arr[2] = horaParaInput(t.retorno_intervalo)
  }
  arr[n - 1] = horaParaInput(t.saida)
  return arr
}

/** Extrai os 4 campos de DB a partir do array de batidas */
function dbFieldsFromBatidas(times: string[]) {
  const n = times.length
  return {
    entrada: times[0] ?? '',
    saida_intervalo: n >= 4 ? (times[1] ?? '') : '',
    retorno_intervalo: n >= 4 ? (times[2] ?? '') : '',
    saida: times[n - 1] ?? '',
  }
}

function emptyHorariosDia(turno?: {
  entrada: string
  saida_intervalo?: string
  retorno_intervalo?: string
  saida: string
}): TurnoHorarioDia[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dia_semana: i,
    trabalha: i !== 0,
    entrada: i !== 0 ? horaParaInput(turno?.entrada) : '',
    saida_intervalo: i !== 0 ? horaParaInput(turno?.saida_intervalo) : '',
    retorno_intervalo: i !== 0 ? horaParaInput(turno?.retorno_intervalo) : '',
    saida: i !== 0 ? horaParaInput(turno?.saida) : '',
    carga_minutos: 0,
  }))
}

const emptyForm = () => ({
  nome: '',
  batidaTimes: ['', '', '', ''] as string[],
  tolerancia_atraso_min: '10',
  tolerancia_extra_min: '10',
  intervalo_minimo_min: '60',
  tipo: 'fixo' as TurnoTipo,
  batidas_esperadas_dia: '4',
  ativo: '1',
})

// ── Timeline bar ──────────────────────────────────────────────────────
function TimelineBar({ times }: { times: string[] }) {
  if (times.length < 2) return null

  let mins = times.map(toMinutes)
  if (mins.some((m) => m < 0)) return null

  // Ajuste overnight: cada valor deve ser >= anterior
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] <= mins[i - 1]) mins[i] += 1440
  }

  const start = mins[0]
  const end = mins[mins.length - 1]
  const total = end - start
  if (total <= 0) return null

  const pct = (m: number) => ((m - start) / total) * 100

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineBar}>
        {times.slice(0, -1).map((_, i) => {
          const segStart = pct(mins[i])
          const segEnd = pct(mins[i + 1])
          const isWork = i % 2 === 0
          return (
            <div
              key={i}
              className={isWork ? styles.timelineWork : styles.timelineInterval}
              style={{ left: `${segStart}%`, width: `${segEnd - segStart}%` }}
            />
          )
        })}
      </div>
      <div className={styles.timelineLabels}>
        <span>{times[0]}</span>
        {times.length > 2 && (
          <span>
            {times[1]}–{times[times.length - 2]} intervalo
          </span>
        )}
        <span>{times[times.length - 1]}</span>
      </div>
    </div>
  )
}

export function CadastroTabelaHorariosPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [lista, setLista] = useState<Turno[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [busca, setBusca] = useState('')

  const [horariosDia, setHorariosDia] = useState<TurnoHorarioDia[]>([])
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [savingHorarios, setSavingHorarios] = useState(false)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

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

  const updateField =
    (field: keyof Omit<ReturnType<typeof emptyForm>, 'batidaTimes'>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  function onBatidasChange(e: ChangeEvent<HTMLSelectElement>) {
    const n = parseInt(e.target.value, 10)
    setForm((f) => ({
      ...f,
      batidas_esperadas_dia: e.target.value,
      batidaTimes: Array.from({ length: n }, (_, i) => f.batidaTimes[i] ?? ''),
    }))
  }

  function updateBatidaTime(i: number, value: string) {
    setForm((f) => {
      const next = [...f.batidaTimes]
      next[i] = value
      const { entrada, saida_intervalo, retorno_intervalo, saida } = dbFieldsFromBatidas(next)
      setHorariosDia((dias) =>
        dias.map((d) =>
          d.trabalha ? { ...d, entrada, saida_intervalo, retorno_intervalo, saida } : d
        )
      )
      return { ...f, batidaTimes: next }
    })
  }

  function startCreating() {
    setEditingId(0)
    setForm(emptyForm())
    setError(null)
    setSuccess(null)
    setHorariosDia([])
    setExpandedDay(null)
  }

  function iniciarEdicao(t: Turno) {
    setExpandedDay(null)
    setEditingId(t.id)
    setForm({
      nome: t.nome,
      batidaTimes: batidaTimesFromTurno(t),
      tolerancia_atraso_min: String(t.tolerancia_atraso_min ?? 10),
      tolerancia_extra_min: String(t.tolerancia_extra_min ?? 10),
      intervalo_minimo_min: String(t.intervalo_minimo_min ?? 60),
      tipo: (t.tipo ?? 'fixo') as TurnoTipo,
      batidas_esperadas_dia: String(t.batidas_esperadas_dia ?? 4),
      ativo: String(t.ativo ?? 1),
    })
    setError(null)
    setSuccess(null)
  }

  useEffect(() => {
    if (editingId == null || editingId === 0) {
      setHorariosDia([])
      return
    }
    setLoadingHorarios(true)
    const turno = lista.find((t) => t.id === editingId)
    fetchTurnoHorarios(editingId)
      .then((rows) => {
        if (rows.length === 0) {
          setHorariosDia(emptyHorariosDia(turno))
        } else {
          const base = emptyHorariosDia(turno)
          for (const r of rows) base[r.dia_semana] = r
          setHorariosDia(base)
        }
      })
      .catch(() => setHorariosDia(emptyHorariosDia(turno)))
      .finally(() => setLoadingHorarios(false))
  }, [editingId, lista])

  function handleDayPillClick(d: TurnoHorarioDia) {
    if (!d.trabalha) {
      const { entrada, saida_intervalo, retorno_intervalo, saida } = dbFieldsFromBatidas(form.batidaTimes)
      setHorariosDia((prev) =>
        prev.map((day) =>
          day.dia_semana !== d.dia_semana
            ? day
            : { ...day, trabalha: true, entrada, saida_intervalo, retorno_intervalo, saida }
        )
      )
      setExpandedDay(d.dia_semana)
    } else {
      setExpandedDay((prev) => (prev === d.dia_semana ? null : d.dia_semana))
    }
  }

  function deactivateDia(diaIndex: number) {
    setHorariosDia((prev) =>
      prev.map((d) =>
        d.dia_semana !== diaIndex
          ? d
          : { ...d, trabalha: false, entrada: '', saida_intervalo: '', retorno_intervalo: '', saida: '' }
      )
    )
  }

  function updateDiaTime(
    diaIndex: number,
    field: 'entrada' | 'saida_intervalo' | 'retorno_intervalo' | 'saida',
    val: string,
  ) {
    setHorariosDia((prev) =>
      prev.map((d) => (d.dia_semana !== diaIndex ? d : { ...d, [field]: val }))
    )
  }

  async function salvarHorariosSilent(id: number) {
    if (horariosDia.length === 0) return
    setSavingHorarios(true)
    try {
      await saveTurnoHorarios(id, horariosDia)
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

    const reHhMm = /^\d{2}:\d{2}$/
    const bLen = form.batidaTimes.length
    // Entrada e Saída são obrigatórios; intermediários (intervalo/retorno) podem ficar em branco
    if (!reHhMm.test(form.batidaTimes[0] ?? '')) {
      setError('Preencha o horário "ENTRADA" no formato HH:MM.')
      return
    }
    if (!reHhMm.test(form.batidaTimes[bLen - 1] ?? '')) {
      setError('Preencha o horário "SAÍDA" no formato HH:MM.')
      return
    }
    for (let i = 1; i < bLen - 1; i++) {
      const t = form.batidaTimes[i]
      if (t && !reHhMm.test(t)) {
        setError(`O horário "${labelBatida(i, bLen)}" está em formato inválido. Use HH:MM ou deixe em branco.`)
        return
      }
    }

    const batidas = parseInt(form.batidas_esperadas_dia, 10)
    const parseMin = (v: string, def: number) => {
      const n = parseInt(v, 10)
      return Number.isNaN(n) ? def : Math.max(0, n)
    }

    const { entrada, saida_intervalo, retorno_intervalo, saida } = dbFieldsFromBatidas(
      form.batidaTimes,
    )

    setSubmitting(true)
    try {
      const batidaTimesJson = JSON.stringify(form.batidaTimes)

      if (editingId != null && editingId > 0) {
        const payload: UpdateTurnoPayload = {
          nome,
          entrada,
          saida_intervalo,
          retorno_intervalo,
          saida,
          tolerancia_atraso_min: parseMin(form.tolerancia_atraso_min, 10),
          tolerancia_extra_min: parseMin(form.tolerancia_extra_min, 10),
          intervalo_minimo_min: parseMin(form.intervalo_minimo_min, 60),
          tipo: form.tipo,
          batidas_esperadas_dia: batidas,
          ativo: form.ativo === '0' ? 0 : 1,
          batida_times_json: batidaTimesJson,
        }
        await updateTurno(editingId, payload)
        await salvarHorariosSilent(editingId)
        setSuccess('Horário atualizado com sucesso.')
      } else {
        const payload: CreateTurnoPayload = {
          nome,
          entrada,
          saida_intervalo,
          retorno_intervalo,
          saida,
          tolerancia_atraso_min: parseMin(form.tolerancia_atraso_min, 10),
          tolerancia_extra_min: parseMin(form.tolerancia_extra_min, 10),
          intervalo_minimo_min: parseMin(form.intervalo_minimo_min, 60),
          tipo: form.tipo,
          batidas_esperadas_dia: batidas,
          batida_times_json: batidaTimesJson,
        }
        await createTurno(payload)
        setSuccess('Turno cadastrado com sucesso.')
        setForm(emptyForm())
        setEditingId(null)
      }
      await loadLista({ silent: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p>Verifique a conexão com o servidor e se o token ainda é válido.</p>
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
        <p>Apenas administradores podem cadastrar tabelas de horários.</p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </p>
      </div>
    )
  }

  const listaFiltrada = lista.filter((t) =>
    t.nome.toLowerCase().includes(busca.toLowerCase()),
  )

  const turnoAtual = lista.find((t) => t.id === editingId)
  const isEditing = editingId != null && editingId > 0
  const isCreating = editingId === 0
  const batidaCount = form.batidaTimes.length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Tabela de horários</h1>
          <p className={styles.subtitle}>
            Selecione um turno à esquerda para editar, ou crie um novo. As regras valem para o
            espelho de todos os colaboradores vinculados.
          </p>
        </div>
        <button type="button" className={styles.btnNew} onClick={startCreating}>
          + Novo turno
        </button>
      </div>

      <div className={styles.layout}>
        {/* ── Painel esquerdo: lista ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarLabel}>TURNOS ATIVOS</span>
            <span className={styles.countChip}>{listaFiltrada.length}</span>
          </div>

          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Pesquisar por nome…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {loadingLista ? (
            <p className={styles.loading}>Carregando…</p>
          ) : listaFiltrada.length === 0 ? (
            <p className={styles.emptyList}>
              {lista.length === 0 ? 'Nenhum turno cadastrado.' : 'Nenhum turno encontrado.'}
            </p>
          ) : (
            <ul className={styles.turnoList}>
              {listaFiltrada.map((t) => (
                <li
                  key={t.id}
                  className={`${styles.turnoCard} ${editingId === t.id ? styles.turnoCardActive : ''}`}
                  onClick={() => iniciarEdicao(t)}
                >
                  <div className={styles.cardRow}>
                    <span className={styles.cardNome}>{t.nome}</span>
                    <span
                      className={`${styles.typeBadge} ${styles[`type_${t.tipo ?? 'fixo'}`] ?? ''}`}
                    >
                      {tipoLabel(t.tipo)}
                    </span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardHora}>
                      {horaParaInput(t.entrada)} – {horaParaInput(t.saida)}
                    </span>
                    <span className={styles.cardColab}>{t.total_funcionarios ?? 0} colab.</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Painel direito: formulário ── */}
        <main className={styles.editPanel}>
          {!isEditing && !isCreating ? (
            <div className={styles.idleState}>
              <svg
                className={styles.idleIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <p>Selecione um turno à esquerda para editar</p>
            </div>
          ) : (
            <div className={styles.editCard}>
              {/* Cabeçalho */}
              <div className={styles.editHeader}>
                <div className={styles.editHeaderLeft}>
                  <div className={styles.editIconBox}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={styles.editTitle}>
                      {isEditing ? 'Editar · ' : 'Novo · '}
                      {form.nome || 'Novo turno'}
                    </h2>
                    {isEditing && turnoAtual && (
                      <p className={styles.editMeta}>
                        {turnoAtual.total_funcionarios ?? 0} colaboradores vinculados ·{' '}
                        {form.batidas_esperadas_dia} batidas/dia
                      </p>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className={styles.editStatus}>
                    <span
                      className={`${styles.statusDot} ${form.ativo === '1' ? styles.statusDotOn : styles.statusDotOff}`}
                    />
                    <select
                      className={styles.statusSelect}
                      value={form.ativo}
                      onChange={updateField('ativo')}
                    >
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
                  </div>
                )}
              </div>

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
                {/* IDENTIFICAÇÃO */}
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>IDENTIFICAÇÃO</div>
                  <div className={styles.rowTwo}>
                    <div className={styles.field}>
                      <label htmlFor="th-nome">NOME DO TURNO</label>
                      <input
                        id="th-nome"
                        value={form.nome}
                        onChange={updateField('nome')}
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="th-tipo">TIPO</label>
                      <select id="th-tipo" value={form.tipo} onChange={updateField('tipo')}>
                        <option value="fixo">Fixo</option>
                        <option value="flexivel">Flexível</option>
                        <option value="escala">Escala</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* JORNADA */}
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>JORNADA</div>

                  <div className={styles.batidasRow}>
                    {form.batidaTimes.map((val, i) => (
                      <div className={styles.field} key={i}>
                        <label htmlFor={`th-batida-${i}`}>{labelBatida(i, batidaCount)}</label>
                        <input
                          id={`th-batida-${i}`}
                          type="time"
                          value={val}
                          onChange={(e) => updateBatidaTime(i, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  {form.batidaTimes.every((t) => /^\d{2}:\d{2}$/.test(t)) && (
                    <TimelineBar times={form.batidaTimes} />
                  )}

                  {isEditing && !loadingHorarios && horariosDia.length > 0 && (
                    <>
                      <div className={styles.diaSubLabel}>HORÁRIOS POR DIA — clique num dia para editar</div>
                      <div className={styles.dayPills}>
                        {horariosDia.map((d) => (
                          <button
                            type="button"
                            key={d.dia_semana}
                            className={[
                              styles.dayPill,
                              d.trabalha ? styles.dayPillActive : '',
                              expandedDay === d.dia_semana ? styles.dayPillSelected : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => handleDayPillClick(d)}
                          >
                            <span className={styles.dayPillName}>{DIAS_LABEL[d.dia_semana]}</span>
                            <span className={styles.dayPillCarga}>
                              {d.trabalha ? calcCargaDisplay(d) : 'Folga'}
                            </span>
                          </button>
                        ))}
                      </div>

                      {expandedDay !== null && horariosDia[expandedDay] && (
                        <div className={styles.diaEditor}>
                          <div className={styles.diaEditorHeader}>
                            <span className={styles.diaEditorName}>{DIAS_LABEL[expandedDay]}</span>
                            <button
                              type="button"
                              className={styles.btnDeactivate}
                              onClick={() => { deactivateDia(expandedDay); setExpandedDay(null) }}
                            >
                              Marcar como folga
                            </button>
                          </div>
                          <div className={styles.diaEditorFields}>
                            <div className={styles.field}>
                              <label>ENTRADA</label>
                              <input
                                type="time"
                                value={horariosDia[expandedDay].entrada}
                                onChange={(e) => updateDiaTime(expandedDay, 'entrada', e.target.value)}
                              />
                            </div>
                            <div className={styles.field}>
                              <label>SAÍDA INT.</label>
                              <input
                                type="time"
                                value={horariosDia[expandedDay].saida_intervalo}
                                onChange={(e) => updateDiaTime(expandedDay, 'saida_intervalo', e.target.value)}
                              />
                            </div>
                            <div className={styles.field}>
                              <label>RETORNO</label>
                              <input
                                type="time"
                                value={horariosDia[expandedDay].retorno_intervalo}
                                onChange={(e) => updateDiaTime(expandedDay, 'retorno_intervalo', e.target.value)}
                              />
                            </div>
                            <div className={styles.field}>
                              <label>SAÍDA</label>
                              <input
                                type="time"
                                value={horariosDia[expandedDay].saida}
                                onChange={(e) => updateDiaTime(expandedDay, 'saida', e.target.value)}
                              />
                            </div>
                          </div>
                          <p className={styles.diaEditorHint}>
                            Deixe os campos de intervalo em branco para dias sem pausa (ex: Sáb 08:00–12:00)
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* REGRAS DE CÁLCULO */}
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>REGRAS DE CÁLCULO</div>
                  <div className={styles.field} style={{ maxWidth: 200 }}>
                    <label htmlFor="th-batidas">BATIDAS/DIA</label>
                    <select
                      id="th-batidas"
                      value={form.batidas_esperadas_dia}
                      onChange={onBatidasChange}
                    >
                      {OPCOES_BATIDAS.map((v) => (
                        <option key={v} value={String(v)}>
                          {v} batidas
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className={styles.btnSave}
                  disabled={submitting || savingHorarios}
                >
                  {submitting || savingHorarios
                    ? 'Salvando…'
                    : isEditing
                      ? 'Salvar alterações'
                      : 'Cadastrar turno'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
