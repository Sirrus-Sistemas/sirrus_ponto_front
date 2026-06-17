import { useEffect, useMemo, useState } from 'react'
import { DatePicker } from '../ui/DatePicker'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  User,
  X,
} from 'lucide-react'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { ApiError } from '../../lib/api'
import {
  fetchEscala,
  fetchFuncionariosComEscala,
  previewEscala,
  deleteEscala,
  salvarEscala,
  type DiaEscala,
  type FuncionarioEscala,
  type TipoCiclo,
} from '../../services/escalasApi'
import { MiniCalendar } from './MiniCalendar'
import {
  calcTotalHours,
  diaSemana,
  feriadosNoPeriodo,
  formatDate,
  inicioCicloHint,
} from './escalaUtils'
import styles from './GerarEscalaPage.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────

type CycleSegment = { type: 'work' | 'off'; flex: number }

const CICLOS: { value: TipoCiclo; label: string; desc: string; segments: CycleSegment[] }[] = [
  {
    value: '1x5',
    label: '1×5',
    desc: '5 trabalho · 1 folga',
    segments: [
      { type: 'work', flex: 1 }, { type: 'work', flex: 1 }, { type: 'work', flex: 1 },
      { type: 'work', flex: 1 }, { type: 'work', flex: 1 }, { type: 'off', flex: 1 },
    ],
  },
  {
    value: '1x6',
    label: '1×6',
    desc: '6 trabalho · 1 folga',
    segments: [
      { type: 'work', flex: 1 }, { type: 'work', flex: 1 }, { type: 'work', flex: 1 },
      { type: 'work', flex: 1 }, { type: 'work', flex: 1 }, { type: 'work', flex: 1 },
      { type: 'off', flex: 1 },
    ],
  },
  {
    value: '12x36',
    label: '12×36',
    desc: '12h on · 36h off',
    segments: [{ type: 'work', flex: 1 }, { type: 'off', flex: 3 }],
  },
  {
    value: '24x72',
    label: '24×72',
    desc: '24h on · 72h off',
    segments: [{ type: 'work', flex: 1 }, { type: 'off', flex: 3 }],
  },
  {
    value: '12x24x12x36',
    label: '12×24×12×36',
    desc: 'Ciclo misto 5 dias',
    segments: [
      { type: 'work', flex: 12 }, { type: 'off', flex: 24 },
      { type: 'work', flex: 12 }, { type: 'off', flex: 36 },
    ],
  },
]

type FormState = {
  funcionario_id: string
  data_inicio: string
  data_fim: string
  tipo_ciclo: TipoCiclo
  inicio_ciclo: string
  entrada1: string; saida1: string
  entrada2: string; saida2: string
  entrada3: string; saida3: string
  entrada4: string; saida4: string
  fim_noturno: string
}

const emptyForm = (): FormState => ({
  funcionario_id: '',
  data_inicio: '',
  data_fim: '',
  tipo_ciclo: '1x5',
  inicio_ciclo: '',
  entrada1: '', saida1: '',
  entrada2: '', saida2: '',
  entrada3: '', saida3: '',
  entrada4: '', saida4: '',
  fim_noturno: '',
})

function canGerar(role: string | undefined) {
  return role === 'admin' || role === 'gestor'
}

function getInitials(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// ── Component ──────────────────────────────────────────────────────────────────

export function GerarEscalaPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const navigate = useNavigate()

  const [funcionarios, setFuncionarios] = useState<FuncionarioEscala[]>([])
  const [loadingFuncs, setLoadingFuncs] = useState(true)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [preview, setPreview] = useState<DiaEscala[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activePairs, setActivePairs] = useState(2)
  const [tableOpen, setTableOpen] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load employees
  useEffect(() => {
    let cancelled = false
    setLoadingFuncs(true)
    fetchFuncionariosComEscala()
      .then((list) => { if (!cancelled) setFuncionarios(list) })
      .catch(() => { if (!cancelled) setFuncionarios([]) })
      .finally(() => { if (!cancelled) setLoadingFuncs(false) })
    return () => { cancelled = true }
  }, [])

  // Autofill work hours from selected employee's shift
  useEffect(() => {
    if (!form.funcionario_id) return
    const func = funcionarios.find((f) => String(f.id) === form.funcionario_id)
    if (!func) return
    setForm((prev) => ({
      ...prev,
      entrada1: func.turno_entrada?.slice(0, 5) ?? '',
      saida1:   func.saida_intervalo?.slice(0, 5) ?? func.turno_saida?.slice(0, 5) ?? '',
      entrada2: func.retorno_intervalo?.slice(0, 5) ?? '',
      saida2:   func.retorno_intervalo ? (func.turno_saida?.slice(0, 5) ?? '') : '',
    }))
  }, [form.funcionario_id, funcionarios])

  // Detect if a saved escala already exists for this employee + period
  useEffect(() => {
    if (!form.funcionario_id || !form.data_inicio || !form.data_fim) {
      setIsEditing(false)
      return
    }
    if (form.data_inicio > form.data_fim) return
    let cancelled = false
    fetchEscala(Number(form.funcionario_id), form.data_inicio, form.data_fim)
      .then((dias) => {
        if (cancelled) return
        if (dias.length > 0) {
          setIsEditing(true)
          // Pre-populate tipo_ciclo, inicio_ciclo and time pairs from the saved escala
          const anyDay = dias[0]
          const workDay = dias.find((d) => d.tipo === 'trabalho')
          setForm((prev) => ({
            ...prev,
            tipo_ciclo:  anyDay.tipo_ciclo  ?? prev.tipo_ciclo,
            inicio_ciclo: anyDay.inicio_ciclo ?? prev.inicio_ciclo,
            entrada1: workDay?.entrada1?.slice(0, 5) || prev.entrada1,
            saida1:   workDay?.saida1?.slice(0, 5)   || prev.saida1,
            entrada2: workDay?.entrada2?.slice(0, 5) || prev.entrada2,
            saida2:   workDay?.saida2?.slice(0, 5)   || prev.saida2,
            entrada3: workDay?.entrada3?.slice(0, 5) || prev.entrada3,
            saida3:   workDay?.saida3?.slice(0, 5)   || prev.saida3,
            entrada4: workDay?.entrada4?.slice(0, 5) || prev.entrada4,
            saida4:   workDay?.saida4?.slice(0, 5)   || prev.saida4,
            fim_noturno: workDay?.fim_noturno?.slice(0, 5) || prev.fim_noturno,
          }))
        } else {
          setIsEditing(false)
        }
      })
      .catch(() => { if (!cancelled) setIsEditing(false) })
    return () => { cancelled = true }
  }, [form.funcionario_id, form.data_inicio, form.data_fim])

  // Auto-preview: debounced 400ms after any form change
  useEffect(() => {
    const isValid =
      form.funcionario_id &&
      form.data_inicio &&
      form.data_fim &&
      form.data_inicio <= form.data_fim &&
      form.inicio_ciclo &&
      form.entrada1 &&
      form.saida1

    if (!isValid) return

    const timer = setTimeout(async () => {
      setLoadingPreview(true)
      try {
        const dias = await previewEscala(buildPayload(form))
        setPreview(dias)
      } catch {
        // silently ignore auto-preview errors
      } finally {
        setLoadingPreview(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.funcionario_id, form.data_inicio, form.data_fim, form.tipo_ciclo,
    form.inicio_ciclo, form.entrada1, form.saida1, form.entrada2, form.saida2,
    form.entrada3, form.saida3, form.entrada4, form.saida4, form.fim_noturno,
  ])

  function buildPayload(f: FormState) {
    return {
      funcionario_id: Number(f.funcionario_id),
      data_inicio:    f.data_inicio,
      data_fim:       f.data_fim,
      tipo_ciclo:     f.tipo_ciclo,
      inicio_ciclo:   f.inicio_ciclo,
      entrada1:  f.entrada1  || undefined,
      saida1:    f.saida1    || undefined,
      entrada2:  f.entrada2  || undefined,
      saida2:    f.saida2    || undefined,
      entrada3:  f.entrada3  || undefined,
      saida3:    f.saida3    || undefined,
      entrada4:  f.entrada4  || undefined,
      saida4:    f.saida4    || undefined,
      fim_noturno: f.fim_noturno || undefined,
    }
  }

  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      setSaveError(null)
      setSuccess(null)
    }
  }

  function setCiclo(value: TipoCiclo) {
    setForm((prev) => ({ ...prev, tipo_ciclo: value }))
    setSaveError(null)
    setSuccess(null)
  }

  function removePar(n: 2 | 3 | 4) {
    setForm((prev) => ({
      ...prev,
      [`entrada${n}`]: '', [`saida${n}`]: '',
      ...(n <= 3 ? { entrada4: '', saida4: '' } : {}),
      ...(n <= 2 ? { entrada3: '', saida3: '' } : {}),
    }))
    setActivePairs(n - 1)
  }

  function validate() {
    if (!form.funcionario_id) return 'Selecione um funcionário.'
    if (!form.data_inicio || !form.data_fim) return 'Informe o período.'
    if (form.data_inicio > form.data_fim) return 'Data de início deve ser anterior à data fim.'
    if (!form.inicio_ciclo) return 'Informe a data de início do ciclo.'
    if (!form.entrada1 || !form.saida1) return 'Informe pelo menos Entrada 1 e Saída 1.'
    return null
  }

  function fieldError(field: keyof FormState): string | null {
    if (!submitAttempted) return null
    switch (field) {
      case 'funcionario_id': return !form.funcionario_id ? 'Selecione um funcionário.' : null
      case 'data_inicio':    return !form.data_inicio ? 'Informe a data de início.' : null
      case 'data_fim':
        if (!form.data_fim) return 'Informe a data de fim.'
        if (form.data_inicio && form.data_fim < form.data_inicio) return 'Deve ser posterior ao início.'
        return null
      case 'inicio_ciclo':   return !form.inicio_ciclo ? 'Informe a data de início do ciclo.' : null
      case 'entrada1':       return !form.entrada1 ? 'Informe a entrada.' : null
      case 'saida1':         return !form.saida1 ? 'Informe a saída.' : null
      default:               return null
    }
  }

  async function handleDelete() {
    if (!form.funcionario_id || !form.data_inicio || !form.data_fim) return
    setDeleting(true)
    setSaveError(null)
    try {
      await deleteEscala(Number(form.funcionario_id), form.data_inicio, form.data_fim)
      setSuccess('Escala excluída com sucesso.')
      setIsEditing(false)
      setPreview(null)
      setConfirmDelete(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Erro ao excluir escala.')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSalvar() {
    setSubmitAttempted(true)
    const err = validate()
    if (err) { setSaveError(err); return }
    setSaveError(null)
    setSaving(true)
    try {
      const total = await salvarEscala(buildPayload(form))
      setSuccess(`${total} dias ${isEditing ? 'atualizados' : 'gravados'} com sucesso.`)
      setIsEditing(true)
      const qs = new URLSearchParams({
        funcionario_id: form.funcionario_id,
        inicio: form.data_inicio,
        fim:    form.data_fim,
      }).toString()
      setTimeout(() => navigate(`/escalas/ajustar?${qs}`), 800)
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Erro ao salvar escala.')
    } finally {
      setSaving(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const funcSelecionado = funcionarios.find((f) => String(f.id) === form.funcionario_id)

  const totalTrabalho = preview?.filter((d) => d.tipo === 'trabalho').length ?? 0
  const totalFolga    = preview?.filter((d) => d.tipo === 'folga').length ?? 0
  const totalHoras    = useMemo(() => preview ? calcTotalHours(preview) : 0, [preview])

  const feriados = useMemo(
    () => feriadosNoPeriodo(form.data_inicio, form.data_fim),
    [form.data_inicio, form.data_fim]
  )

  const step1Done = Boolean(form.funcionario_id && form.data_inicio && form.data_fim)
  const step2Done = Boolean(form.inicio_ciclo)
  const step3Done = Boolean(form.entrada1 && form.saida1)
  const canSave   = step1Done && step2Done && step3Done &&
                    form.data_inicio <= form.data_fim

  const paresAtivos = [
    form.entrada1 || form.saida1,
    form.entrada2 || form.saida2,
    form.entrada3 || form.saida3,
    form.entrada4 || form.saida4,
  ].filter(Boolean).length || 0

  // ── Guards ────────────────────────────────────────────────────────────────────

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me || !canGerar(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores ou gestores podem gerar escalas.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Breadcrumb + Header ── */}
      <nav className={styles.breadcrumb}>
        <Link to="/dashboard" className={styles.breadcrumbLink}>Movimentações</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span>{isEditing ? 'Editar Escala' : 'Gerar Escala'}</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>
            {isEditing ? 'Editar Escala' : 'Gerar Escala'}
          </h1>
          <p className={styles.subtitle}>
            {isEditing
              ? 'Edite o ciclo de trabalho e salve para atualizar a escala'
              : 'Configure o ciclo de trabalho e visualize a escala antes de gerar'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={() => navigate(-1)}
          >
            Cancelar
          </button>
          {isEditing && !confirmDelete && (
            <button
              type="button"
              className={styles.btnDelete}
              onClick={() => setConfirmDelete(true)}
              disabled={deleting || saving}
            >
              Excluir escala
            </button>
          )}
          {isEditing && confirmDelete && (
            <div className={styles.confirmDeleteInline}>
              <span>Confirmar exclusão?</span>
              <button
                type="button"
                className={styles.btnDeleteConfirm}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Excluindo…' : 'Sim, excluir'}
              </button>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setConfirmDelete(false)}
              >
                Não
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.btnSave}
            onClick={handleSalvar}
            disabled={saving || loadingPreview}
          >
            <CalendarCheck size={15} />
            {saving ? 'Salvando…' : isEditing ? 'Atualizar escala' : 'Gerar escala'}
          </button>
        </div>
      </div>

      {/* ── Stepper ── */}
      <div className={styles.stepper}>
        {([
          { n: 1, label: 'Dados básicos', done: step1Done },
          { n: 2, label: 'Tipo de ciclo', done: step2Done },
          { n: 3, label: 'Horários',       done: step3Done },
        ] as const).map(({ n, label, done }, idx) => {
          const active = !step1Done ? n === 1 : !step2Done ? n === 2 : n === 3
          return (
            <div key={n} className={styles.stepGroup}>
              {idx > 0 && <div className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />}
              <div className={`${styles.step} ${done ? styles.stepDone : active ? styles.stepActive : ''}`}>
                <div className={styles.stepBadge}>
                  {done ? <Check size={11} strokeWidth={3} /> : n}
                </div>
                <span className={styles.stepLabel}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Success / Save Error banners ── */}
      {success  && <p className={`${styles.banner} ${styles.bannerOk}`}>{success}</p>}
      {saveError && <p className={`${styles.banner} ${styles.bannerErr}`}>{saveError}</p>}

      {/* ── Two-column layout ── */}
      <div className={styles.layout}>

        {/* ═══ Left column — Form cards ═══ */}
        <div className={styles.formCol}>

          {/* Card 1 — Funcionário e período */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <User size={14} className={styles.cardIcon} />
              <span>Funcionário e período</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="ge-func" className={styles.label}>Funcionário</label>
              {loadingFuncs ? (
                <p className={styles.hint}>Carregando funcionários…</p>
              ) : (
                <select
                  id="ge-func"
                  className={`${styles.select} ${fieldError('funcionario_id') ? styles.inputErr : ''}`}
                  value={form.funcionario_id}
                  onChange={update('funcionario_id')}
                >
                  <option value="">— Selecione —</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}{f.matricula ? ` (${f.matricula})` : ''}{f.filial_nome ? ` — ${f.filial_nome}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {fieldError('funcionario_id') && <p className={styles.errMsg}>{fieldError('funcionario_id')}</p>}
            </div>

            {funcSelecionado && (
              <div className={styles.funcCard}>
                <div className={styles.funcAvatar}>{getInitials(funcSelecionado.nome)}</div>
                <div className={styles.funcInfo}>
                  <span className={styles.funcName}>{funcSelecionado.nome}</span>
                  <span className={styles.funcMeta}>
                    {funcSelecionado.cargo ?? 'Sem cargo'} · {funcSelecionado.filial_nome ?? 'Sem filial'}
                  </span>
                </div>
              </div>
            )}

            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="ge-di" className={styles.label}>Início</label>
                <DatePicker
                  id="ge-di"
                  value={form.data_inicio}
                  onChange={update('data_inicio')}
                  error={!!fieldError('data_inicio')}
                />
                {fieldError('data_inicio') && <p className={styles.errMsg}>{fieldError('data_inicio')}</p>}
              </div>
              <div className={styles.field}>
                <label htmlFor="ge-df" className={styles.label}>Fim</label>
                <DatePicker
                  id="ge-df"
                  value={form.data_fim}
                  onChange={update('data_fim')}
                  error={!!fieldError('data_fim')}
                />
                {fieldError('data_fim') && <p className={styles.errMsg}>{fieldError('data_fim')}</p>}
              </div>
            </div>
          </div>

          {/* Card 2 — Tipo de ciclo */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Calendar size={14} className={styles.cardIcon} />
              <span>Tipo de ciclo</span>
            </div>

            <div className={styles.cicloGrid}>
              {CICLOS.slice(0, 4).map((c) => {
                const selected = form.tipo_ciclo === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    className={`${styles.cicloCard} ${selected ? styles.cicloCardActive : ''}`}
                    onClick={() => setCiclo(c.value)}
                  >
                    <div className={styles.cicloCardTop}>
                      <span className={styles.cicloLabel}>{c.label}</span>
                      {selected && <Check size={13} className={styles.cicloCheck} />}
                    </div>
                    <span className={styles.cicloDesc}>{c.desc}</span>
                    <div className={styles.cicloBar}>
                      {c.segments.map((seg, i) => (
                        <div
                          key={i}
                          className={seg.type === 'work' ? styles.barWork : styles.barOff}
                          style={{ flex: seg.flex }}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 5th cycle — full width */}
            {(() => {
              const c = CICLOS[4]
              const selected = form.tipo_ciclo === c.value
              return (
                <button
                  type="button"
                  className={`${styles.cicloCard} ${styles.cicloCardFull} ${selected ? styles.cicloCardActive : ''}`}
                  onClick={() => setCiclo(c.value)}
                >
                  <div className={styles.cicloCardTop}>
                    <span className={styles.cicloLabel}>{c.label}</span>
                    {selected && <Check size={13} className={styles.cicloCheck} />}
                  </div>
                  <span className={styles.cicloDesc}>{c.desc}</span>
                  <div className={styles.cicloBar}>
                    {c.segments.map((seg, i) => (
                      <div
                        key={i}
                        className={seg.type === 'work' ? styles.barWork : styles.barOff}
                        style={{ flex: seg.flex }}
                      />
                    ))}
                  </div>
                </button>
              )
            })()}

            <div className={styles.field} style={{ marginTop: '12px' }}>
              <label htmlFor="ge-ic" className={styles.label}>Data de início do ciclo</label>
              <DatePicker
                id="ge-ic"
                value={form.inicio_ciclo}
                onChange={update('inicio_ciclo')}
                error={!!fieldError('inicio_ciclo')}
              />
              {fieldError('inicio_ciclo') && <p className={styles.errMsg}>{fieldError('inicio_ciclo')}</p>}
              {form.inicio_ciclo && (
                <p className={styles.hint}>Início do ciclo: {inicioCicloHint(form.inicio_ciclo)}</p>
              )}
            </div>
          </div>

          {/* Card 3 — Horários */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Clock size={14} className={styles.cardIcon} />
              <span>Horários do dia</span>
              {paresAtivos > 0 && (
                <span className={styles.badge}>{paresAtivos} {paresAtivos === 1 ? 'par ativo' : 'pares ativos'}</span>
              )}
            </div>

            <div className={styles.pares}>
              {/* Par 1 — always visible */}
              <div className={styles.parRow}>
                <span className={styles.parLabel}>Par 1</span>
                <input
                  id="ge-e1"
                  type="time"
                  className={`${styles.timeInput} ${fieldError('entrada1') ? styles.inputErr : ''}`}
                  value={form.entrada1}
                  onChange={update('entrada1')}
                />
                <span className={styles.parArrow}>→</span>
                <input
                  id="ge-s1"
                  type="time"
                  className={`${styles.timeInput} ${fieldError('saida1') ? styles.inputErr : ''}`}
                  value={form.saida1}
                  onChange={update('saida1')}
                />
                <div className={styles.parRemovePlaceholder} />
              </div>
              {(fieldError('entrada1') || fieldError('saida1')) && (
                <p className={styles.errMsg} style={{ paddingLeft: '60px' }}>
                  {fieldError('entrada1') || fieldError('saida1')}
                </p>
              )}

              {/* Par 2 */}
              {activePairs >= 2 && (
                <div className={styles.parRow}>
                  <span className={styles.parLabel}>Par 2</span>
                  <input type="time" className={styles.timeInput} value={form.entrada2} onChange={update('entrada2')} />
                  <span className={styles.parArrow}>→</span>
                  <input type="time" className={styles.timeInput} value={form.saida2}   onChange={update('saida2')} />
                  <button
                    type="button"
                    className={styles.parRemove}
                    onClick={() => removePar(2)}
                    aria-label="Remover par 2"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Par 3 */}
              {activePairs >= 3 && (
                <div className={styles.parRow}>
                  <span className={styles.parLabel}>Par 3</span>
                  <input type="time" className={styles.timeInput} value={form.entrada3} onChange={update('entrada3')} />
                  <span className={styles.parArrow}>→</span>
                  <input type="time" className={styles.timeInput} value={form.saida3}   onChange={update('saida3')} />
                  <button
                    type="button"
                    className={styles.parRemove}
                    onClick={() => removePar(3)}
                    aria-label="Remover par 3"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Par 4 */}
              {activePairs >= 4 && (
                <div className={styles.parRow}>
                  <span className={styles.parLabel}>Par 4</span>
                  <input type="time" className={styles.timeInput} value={form.entrada4} onChange={update('entrada4')} />
                  <span className={styles.parArrow}>→</span>
                  <input type="time" className={styles.timeInput} value={form.saida4}   onChange={update('saida4')} />
                  <button
                    type="button"
                    className={styles.parRemove}
                    onClick={() => removePar(4)}
                    aria-label="Remover par 4"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {activePairs < 4 && (
                <button
                  type="button"
                  className={styles.addParBtn}
                  onClick={() => setActivePairs((n) => Math.min(n + 1, 4))}
                >
                  <Plus size={13} />
                  Adicionar par
                </button>
              )}
            </div>

            <div className={styles.field} style={{ marginTop: '12px', maxWidth: '200px' }}>
              <label htmlFor="ge-fn" className={styles.label}>Fim noturno <span className={styles.optional}>(opcional)</span></label>
              <input
                id="ge-fn"
                type="time"
                className={styles.timeInput}
                value={form.fim_noturno}
                onChange={update('fim_noturno')}
              />
            </div>
          </div>
        </div>

        {/* ═══ Right column — Preview panel ═══ */}
        <div className={styles.previewCol}>
          <div className={styles.previewCard}>

            {/* Heading */}
            <div className={styles.previewHeading}>
              <span>Pré-visualização</span>
              {loadingPreview && <span className={styles.previewLoading}>Calculando…</span>}
            </div>

            {/* Metrics */}
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <span className={styles.metricValue} style={{ color: '#0F6E56' }}>{totalTrabalho}</span>
                <span className={styles.metricLabel}>dias</span>
                <span className={styles.metricSub}>Trabalho</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricValue}>{totalFolga}</span>
                <span className={styles.metricLabel}>dias</span>
                <span className={styles.metricSub}>Folgas</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricValue}>{totalHoras > 0 ? `${totalHoras}h` : '—'}</span>
                <span className={styles.metricSub} style={{ marginTop: 0 }}>Total no mês</span>
              </div>
            </div>

            {/* Mini calendar */}
            <MiniCalendar
              preview={preview}
              dataInicio={form.data_inicio}
              dataFim={form.data_fim}
            />

            {/* Contextual alerts */}
            {feriados.length > 0 && (
              <div className={styles.alertBlue}>
                Há {feriados.length} feriado{feriados.length > 1 ? 's' : ''} no período
                ({feriados.map((f) => {
                  const [, m, d] = f.split('-')
                  return `${d}/${m}`
                }).join(', ')}).
                Você pode definir se será trabalhado ou folga.
              </div>
            )}

            {form.data_inicio && form.data_fim && form.data_inicio > form.data_fim && (
              <div className={styles.alertRed}>
                A data de fim deve ser posterior à data de início.
              </div>
            )}

            {!canSave && !saveError && (
              <div className={styles.alertGray}>
                Preencha todos os campos obrigatórios para habilitar a geração.
              </div>
            )}

            {/* Collapsible detail table */}
            {preview && preview.length > 0 && (
              <div className={styles.tableSection}>
                <button
                  type="button"
                  className={styles.tableToggle}
                  onClick={() => setTableOpen((o) => !o)}
                >
                  Ver detalhes — {preview.length} dias
                  {tableOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {tableOpen && (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Dia</th>
                          <th>Tipo</th>
                          <th>Entrada 1</th>
                          <th>Saída 1</th>
                          <th>Entrada 2</th>
                          <th>Saída 2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((d) => (
                          <tr key={d.data} className={d.tipo === 'folga' ? styles.rowFolga : ''}>
                            <td>{formatDate(d.data)}</td>
                            <td>{diaSemana(d.data)}</td>
                            <td>
                              <span className={d.tipo === 'folga' ? styles.badgeFolga : styles.badgeTrabalho}>
                                {d.tipo === 'folga' ? 'Folga' : 'Trabalho'}
                              </span>
                            </td>
                            <td>{d.entrada1 ?? '—'}</td>
                            <td>{d.saida1   ?? '—'}</td>
                            <td>{d.entrada2 ?? '—'}</td>
                            <td>{d.saida2   ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
