import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  History,
  Pencil,
  User,
} from 'lucide-react'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  fetchEscala,
  fetchFuncionariosComEscala,
  updateDiaEscala,
  type DiaEscala,
  type FuncionarioEscala,
} from '../../services/escalasApi'
import { diaSemana, formatDate, toLocalDate } from './escalaUtils'
import styles from './AjustarEscalaPage.module.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function mesAno(iso: string): string {
  const d = toLocalDate(iso)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

type TipoAjuste = 'trabalho' | 'folga' | 'falta'

type HistoryEntry = {
  id: number
  ts: string
  desc: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AjustarEscalaPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const inicioParam = params.get('inicio') ?? ''
  const fimParam    = params.get('fim')    ?? ''
  const funcParam   = params.get('funcionario_id') ?? ''

  const [funcionarios, setFuncionarios] = useState<FuncionarioEscala[]>([])
  const [funcIdx, setFuncIdx] = useState(0)
  const [escala, setEscala] = useState<DiaEscala[]>([])
  const [overrides, setOverrides] = useState<Record<string, TipoAjuste>>({})
  const [loadingEscala, setLoadingEscala] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [calMonth, setCalMonth] = useState<{ year: number; month: number } | null>(null)

  // Load employees
  useEffect(() => {
    fetchFuncionariosComEscala()
      .then((list) => {
        setFuncionarios(list)
        const idx = list.findIndex((f) => String(f.id) === funcParam)
        setFuncIdx(idx >= 0 ? idx : 0)
      })
      .catch(() => setFuncionarios([]))
  }, [funcParam])

  // Set initial calendar month from period start
  useEffect(() => {
    if (!inicioParam) return
    const d = toLocalDate(inicioParam)
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() })
  }, [inicioParam])

  const currentFunc = funcionarios[funcIdx]

  // Load escala when employee changes
  useEffect(() => {
    if (!currentFunc || !inicioParam || !fimParam) return
    setLoadingEscala(true)
    setSelectedDate(null)
    setOverrides({})
    fetchEscala(currentFunc.id, inicioParam, fimParam)
      .then((dias) => setEscala(dias))
      .catch(() => setEscala([]))
      .finally(() => setLoadingEscala(false))
  }, [currentFunc?.id, inicioParam, fimParam])

  const escalaMap = useMemo(() => {
    const m: Record<string, DiaEscala> = {}
    for (const d of escala) m[d.data] = d
    return m
  }, [escala])

  function tipoEfetivo(data: string): TipoAjuste | undefined {
    return overrides[data] ?? (escalaMap[data]?.tipo as TipoAjuste | undefined)
  }

  const totalTrabalho = useMemo(() => {
    if (!inicioParam || !fimParam || !calMonth) return 0
    return Object.keys(escalaMap).filter((d) => tipoEfetivo(d) === 'trabalho').length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalaMap, overrides])

  const ajustesCount = Object.keys(overrides).length + history.length

  async function handleChangeTipo(data: string, tipo: TipoAjuste) {
    if (!currentFunc) return
    setSavingDate(data)
    try {
      await updateDiaEscala(currentFunc.id, { data, tipo })
      setOverrides((prev) => ({ ...prev, [data]: tipo }))
      setHistory((prev) => [
        {
          id: Date.now(),
          ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          desc: `${currentFunc.nome.split(' ')[0]} · ${formatShortDate(data)} → ${tipo}`,
        },
        ...prev,
      ])
    } catch {
      // keep override local anyway to show intent
      setOverrides((prev) => ({ ...prev, [data]: tipo }))
    } finally {
      setSavingDate(null)
    }
  }

  // ── Calendar ─────────────────────────────────────────────────────────────────

  const grid = useMemo(
    () => (calMonth ? buildMonthGrid(calMonth.year, calMonth.month) : []),
    [calMonth]
  )

  function prevMonth() {
    setCalMonth((c) => {
      if (!c) return c
      const d = new Date(c.year, c.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function nextMonth() {
    setCalMonth((c) => {
      if (!c) return c
      const d = new Date(c.year, c.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function isInPeriod(data: string) {
    return data >= inicioParam && data <= fimParam
  }

  // ── Selected day panel ────────────────────────────────────────────────────────

  const selectedDia = selectedDate ? escalaMap[selectedDate] : null
  const selectedTipo = selectedDate ? tipoEfetivo(selectedDate) : undefined

  // ── Guards ────────────────────────────────────────────────────────────────────

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me || (me.role !== 'admin' && me.role !== 'gestor')) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores ou gestores podem ajustar escalas.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  const periodoLabel = inicioParam
    ? `${mesAno(inicioParam)}${inicioParam.slice(0, 7) !== fimParam.slice(0, 7) ? ` – ${mesAno(fimParam)}` : ''}`
    : '—'

  const calMonthLabel = calMonth
    ? new Date(calMonth.year, calMonth.month, 1)
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : ''

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Breadcrumb ── */}
      <nav className={styles.breadcrumb}>
        <Link to="/dashboard" className={styles.breadcrumbLink}>Movimentações</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <Link to="/escalas/gerar" className={styles.breadcrumbLink}>Gerar Escala</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span>Ajustar escala salva</span>
      </nav>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Ajustar escala</h1>
          <span className={styles.badgeSalva}><Check size={11} strokeWidth={3} /> Escala salva</span>
        </div>
        <p className={styles.subtitle}>
          {currentFunc?.filial_nome ?? 'Filial'} · {periodoLabel}
          {ajustesCount > 0 && ` · ${ajustesCount} ajuste${ajustesCount !== 1 ? 's' : ''} desde então`}
        </p>
      </div>

      {/* ── CTA bar ── */}
      <div className={styles.ctaBar}>
        <button type="button" className={styles.btnGhost} onClick={() => setHistoryOpen((o) => !o)}>
          <History size={14} /> Histórico completo
        </button>
        <button type="button" className={styles.btnGhost}>
          <FileText size={14} /> Exportar PDF
        </button>
        <button
          type="button"
          className={styles.btnConcluir}
          onClick={() => navigate('/escalas/gerar')}
        >
          <Check size={14} /> Concluir ajustes
        </button>
      </div>

      {/* ── Two-column layout ── */}
      <div className={styles.layout}>

        {/* ═══ Left panel ═══ */}
        <aside className={styles.sidePanel}>

          {/* Funcionário switcher */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <User size={14} className={styles.cardIcon} />
              <span>Funcionário em edição</span>
            </div>
            {funcionarios.length > 0 ? (
              <>
                <div className={styles.funcSwitcher}>
                  <button
                    type="button"
                    className={styles.switchBtn}
                    disabled={funcIdx === 0}
                    onClick={() => setFuncIdx((i) => i - 1)}
                    aria-label="Anterior"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div className={styles.funcCardInline}>
                    <div className={styles.funcAvatar}>{getInitials(currentFunc?.nome ?? '')}</div>
                    <div className={styles.funcInfo}>
                      <span className={styles.funcName}>{currentFunc?.nome ?? '—'}</span>
                      <span className={styles.funcMeta}>
                        {currentFunc?.cargo ?? 'Sem cargo'} · {currentFunc?.filial_nome ?? '—'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.switchBtn}
                    disabled={funcIdx === funcionarios.length - 1}
                    onClick={() => setFuncIdx((i) => i + 1)}
                    aria-label="Próximo"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
                <p className={styles.switchMeta}>
                  {funcIdx + 1} de {funcionarios.length} funcionário{funcionarios.length !== 1 ? 's' : ''}
                </p>
                {totalTrabalho > 0 && (
                  <div className={styles.metricRow}>
                    <span className={styles.metricVal}>{totalTrabalho}</span>
                    <span className={styles.metricLbl}>dias de trabalho no período</span>
                  </div>
                )}
              </>
            ) : (
              <p className={styles.hint}>Carregando funcionários…</p>
            )}
          </div>

          {/* Config summary (read-only) */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Clock size={14} className={styles.cardIcon} />
              <span>Configuração da escala</span>
            </div>
            <dl className={styles.configList}>
              <div className={styles.configRow}>
                <dt>Filial</dt>
                <dd>{currentFunc?.filial_nome ?? '—'}</dd>
              </div>
              <div className={styles.configRow}>
                <dt>Período</dt>
                <dd>{inicioParam ? `${formatDate(inicioParam)} – ${formatDate(fimParam)}` : '—'}</dd>
              </div>
              <div className={styles.configRow}>
                <dt>Horário base</dt>
                <dd>
                  {currentFunc?.turno_entrada
                    ? `${currentFunc.turno_entrada.slice(0, 5)} – ${currentFunc.turno_saida?.slice(0, 5) ?? '?'}`
                    : '—'}
                </dd>
              </div>
            </dl>
            <Link to="/escalas/gerar" className={styles.editConfigLink}>
              <Pencil size={11} /> Editar configuração →
            </Link>
          </div>

          {/* Tips */}
          <div className={`${styles.card} ${styles.cardTip}`}>
            <p className={styles.tipTitle}>Como ajustar</p>
            <p className={styles.tipText}>
              Clique em qualquer dia do calendário para alterar entre Trabalho, Folga ou Falta.
            </p>
            <p className={`${styles.tipText} ${styles.tipAuto}`}>
              Cada alteração é salva automaticamente.
            </p>
          </div>

        </aside>

        {/* ═══ Right panel ═══ */}
        <div className={styles.mainCol}>

          {/* Calendar card */}
          <div className={styles.card}>

            {/* Calendar nav */}
            <div className={styles.calNav}>
              <button type="button" className={styles.calNavBtn} onClick={prevMonth}>
                <ArrowLeft size={14} />
              </button>
              <span className={styles.calMonthLabel}>{calMonthLabel}</span>
              <button type="button" className={styles.calNavBtn} onClick={nextMonth}>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className={styles.calGrid}>
              {/* Day-of-week headers */}
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className={styles.calDow}>{d}</div>
              ))}

              {/* Day cells */}
              {grid.map((data, i) => {
                if (!data) return <div key={`e-${i}`} className={styles.calEmpty} />
                const inPeriod = isInPeriod(data)
                const tipo = tipoEfetivo(data)
                const isSelected = selectedDate === data
                const isSaving = savingDate === data
                const dayNum = Number(data.slice(-2))

                return (
                  <button
                    key={data}
                    type="button"
                    disabled={!inPeriod}
                    onClick={() => setSelectedDate(isSelected ? null : data)}
                    className={[
                      styles.calDay,
                      !inPeriod ? styles.calDayOut : '',
                      inPeriod && tipo === 'trabalho' ? styles.calDayWork : '',
                      inPeriod && tipo === 'folga'    ? styles.calDayOff  : '',
                      inPeriod && tipo === 'falta'    ? styles.calDayFalta : '',
                      isSelected ? styles.calDaySelected : '',
                      isSaving   ? styles.calDaySaving   : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className={styles.calDayNum}>{dayNum}</span>
                    {inPeriod && tipo && (
                      <span className={styles.calDayDot} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className={styles.legend}>
              <span className={`${styles.legendDot} ${styles.legendWork}`} /> Trabalho
              <span className={`${styles.legendDot} ${styles.legendOff}`}  /> Folga
              <span className={`${styles.legendDot} ${styles.legendFalta}`}/> Falta
            </div>

            {/* Day detail panel */}
            {selectedDate && (
              <div className={styles.dayPanel}>
                <div className={styles.dayPanelHeader}>
                  <span className={styles.dayPanelDate}>
                    {formatDate(selectedDate)} · {diaSemana(selectedDate)}
                  </span>
                  {savingDate === selectedDate && (
                    <span className={styles.dayPanelSaving}>Salvando…</span>
                  )}
                </div>

                <div className={styles.dayPanelTypes}>
                  {(['trabalho', 'folga', 'falta'] as TipoAjuste[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={savingDate === selectedDate}
                      className={[
                        styles.tipoBtn,
                        t === 'trabalho' ? styles.tipoBtnWork  : '',
                        t === 'folga'    ? styles.tipoBtnOff   : '',
                        t === 'falta'    ? styles.tipoBtnFalta : '',
                        selectedTipo === t ? styles.tipoBtnActive : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleChangeTipo(selectedDate, t)}
                    >
                      {selectedTipo === t && <Check size={12} strokeWidth={3} />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {selectedDia && selectedDia.tipo === 'trabalho' && (
                  <div className={styles.dayPanelHours}>
                    {selectedDia.entrada1 && (
                      <span>{selectedDia.entrada1.slice(0, 5)} – {selectedDia.saida1?.slice(0, 5) ?? '?'}</span>
                    )}
                    {selectedDia.entrada2 && (
                      <span>{selectedDia.entrada2.slice(0, 5)} – {selectedDia.saida2?.slice(0, 5) ?? '?'}</span>
                    )}
                  </div>
                )}

                <div className={styles.coberturaSection}>
                  <p className={styles.coberturaTitle}>Coberturas disponíveis</p>
                  <p className={styles.coberturaEmpty}>Nenhuma cobertura cadastrada para este dia.</p>
                </div>
              </div>
            )}

            {loadingEscala && (
              <p className={styles.calLoading}>Carregando escala…</p>
            )}
          </div>

          {/* History log */}
          {history.length > 0 && (
            <div className={styles.card}>
              <button
                type="button"
                className={styles.historyToggle}
                onClick={() => setHistoryOpen((o) => !o)}
              >
                <History size={14} />
                Histórico de ajustes ({history.length})
                {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {historyOpen && (
                <ul className={styles.historyList}>
                  {history.map((h) => (
                    <li key={h.id} className={styles.historyItem}>
                      <CalendarCheck size={13} className={styles.historyIcon} />
                      <span className={styles.historyDesc}>{h.desc}</span>
                      <span className={styles.historyTs}>{h.ts}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
