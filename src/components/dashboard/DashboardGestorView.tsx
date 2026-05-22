import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { parseDataHoraUtc } from '../../lib/parseDataHora'
import { fetchEspelho, type EspelhoPayload, type DiaEspelho } from '../../services/espelhoApi'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchOcorrencias, type Ocorrencia } from '../../services/ocorrenciasApi'
import type { FuncionarioMe } from '../../services/userApi'
import { hojeIsoPtBr, anoMesEspelhoPtBr, formatSaldoMesPt } from './dashboardDiaUtils'
import styles from './DashboardGestorView.module.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saudacao(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function hojeExtenso(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  })
}

function formatHHmm(d: Date): string {
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
}

function initials(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

type StatusPresenca = {
  label: string
  variant: 'trabalhando' | 'intervalo' | 'encerrado' | 'falta' | 'folga' | 'aguardando'
}

function statusPresenca(dia: DiaEspelho | undefined, hojeStr: string): StatusPresenca {
  if (!dia || dia.data !== hojeStr) return { label: 'Aguardando', variant: 'aguardando' }
  if (dia.status === 'falta') return { label: 'Falta', variant: 'falta' }
  if (dia.status === 'folga') return { label: 'Folga', variant: 'folga' }
  if (dia.status === 'feriado') return { label: 'Feriado', variant: 'folga' }
  const n = dia.marcacoes.length
  if (n === 0) return { label: 'Aguardando', variant: 'aguardando' }
  if (dia.incompleto && n % 2 === 1) return { label: 'Trabalhando', variant: 'trabalhando' }
  if (dia.incompleto && n % 2 === 0) return { label: 'Intervalo', variant: 'intervalo' }
  if (!dia.incompleto) return { label: 'Encerrado', variant: 'encerrado' }
  return { label: 'Aguardando', variant: 'aguardando' }
}

function ultimaBatidaHora(dia: DiaEspelho | undefined): string {
  if (!dia?.marcacoes.length) return '—'
  const sorted = [...dia.marcacoes].sort((a, b) => a.data_hora.localeCompare(b.data_hora))
  const last = sorted.at(-1)
  if (!last) return '—'
  try { return formatHHmm(parseDataHoraUtc(last.data_hora)) } catch { return '—' }
}

function diasAteFinsMes(espelho: EspelhoPayload): number {
  const ultimoDia = new Date(espelho.ano, espelho.mes, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((ultimoDia.getTime() - hoje.getTime()) / 86400000))
}

function formatDataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

type TeamMember = {
  funcionario: FuncionarioListItem
  espelho: EspelhoPayload | null
  loading: boolean
}

export function DashboardGestorView({ me, switcherNode }: { me: FuncionarioMe; switcherNode?: ReactNode }) {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [myEspelho, setMyEspelho] = useState<EspelhoPayload | null>(null)

  const hojeStr = hojeIsoPtBr()
  const { ano, mes } = anoMesEspelhoPtBr()

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadingTeam(true)
      setTeamError(null)
      try {
        const [{ data: funcionarios }, esp, ocorrs] = await Promise.all([
          fetchFuncionarios({ ativo: 1, limit: 50 }),
          fetchEspelho(ano, mes),
          fetchOcorrencias({ ano, mes }),
        ])
        if (cancelled) return
        setMyEspelho(esp)
        setOcorrencias(ocorrs)

        const initial: TeamMember[] = funcionarios.map((f) => ({
          funcionario: f,
          espelho: null,
          loading: true,
        }))
        setTeam(initial)
        setLoadingTeam(false)

        // carrega espelhos dos funcionários em série (lotes de 5, 300ms entre lotes)
        const BATCH = 5
        for (let i = 0; i < funcionarios.length; i += BATCH) {
          if (cancelled) return
          if (i > 0) await new Promise((r) => setTimeout(r, 300))
          const batch = funcionarios.slice(i, i + BATCH)
          const results = await Promise.allSettled(
            batch.map((f) => fetchEspelho(ano, mes, f.id))
          )
          if (cancelled) return
          setTeam((prev) => {
            const next = [...prev]
            batch.forEach((f, j) => {
              const idx = next.findIndex((m) => m.funcionario.id === f.id)
              if (idx !== -1) {
                next[idx] = {
                  ...next[idx]!,
                  espelho: results[j]?.status === 'fulfilled' ? results[j].value : null,
                  loading: false,
                }
              }
            })
            return next
          })
        }
      } catch (e) {
        if (!cancelled)
          setTeamError(e instanceof ApiError ? e.message : 'Não foi possível carregar a equipe.')
        setLoadingTeam(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [ano, mes])

  // ── Contadores de presença ──────────────────────────────────────────────────
  const contadores = useMemo(() => {
    const total = team.length
    let trabalhando = 0, intervalo = 0, folga = 0, falta = 0
    for (const m of team) {
      const dia = m.espelho?.dias.find((d) => d.data === hojeStr)
      const s = statusPresenca(dia, hojeStr)
      if (s.variant === 'trabalhando') trabalhando++
      else if (s.variant === 'intervalo') intervalo++
      else if (s.variant === 'folga') folga++
      else if (s.variant === 'falta') falta++
    }
    return { total, trabalhando, intervalo, folga, falta }
  }, [team, hojeStr])

  // ── Fechamento ──────────────────────────────────────────────────────────────
  const fechamento = useMemo(() => {
    if (!myEspelho) return null
    const diasRestantes = diasAteFinsMes(myEspelho)
    const mesNome = new Date(myEspelho.ano, myEspelho.mes - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long' })
    const completos = team.filter((m) => {
      if (!m.espelho) return false
      return m.espelho.resumo.dias_incompletos === 0 && m.espelho.resumo.dias_presentes > 0
    }).length
    const pendencias = team.filter((m) => {
      if (!m.espelho) return false
      return m.espelho.resumo.dias_incompletos > 0 || m.espelho.resumo.dias_falta > 0
    }).length
    return { diasRestantes, mesNome, completos, pendencias, total: team.length }
  }, [myEspelho, team])

  // ── Heatmap (dias do mês atual) ─────────────────────────────────────────────
  const heatmap = useMemo(() => {
    if (!myEspelho || team.length === 0) return []
    const dias: { dia: number; pct: number; futuro: boolean }[] = []
    const totalDias = new Date(myEspelho.ano, myEspelho.mes, 0).getDate()
    const hojeDate = hojeStr

    for (let d = 1; d <= totalDias; d++) {
      const iso = `${myEspelho.ano}-${String(myEspelho.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const futuro = iso > hojeDate
      if (futuro) {
        dias.push({ dia: d, pct: 0, futuro: true })
        continue
      }
      let presentes = 0
      let total = 0
      for (const m of team) {
        const dia = m.espelho?.dias.find((dd) => dd.data === iso)
        if (!dia) continue
        total++
        if (dia.status === 'presente' || (dia.marcacoes.length > 0 && dia.status !== 'falta')) {
          presentes++
        }
      }
      dias.push({ dia: d, pct: total > 0 ? Math.round((presentes / total) * 100) : 0, futuro: false })
    }
    return dias
  }, [myEspelho, team, hojeStr])

  // ── Ocorrências recentes (fila de aprovação) ────────────────────────────────
  const filaAprovacao = useMemo(() => {
    return [...ocorrencias]
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))
      .slice(0, 6)
  }, [ocorrencias])

  const primeiroPrimeiroNome = me.nome.split(' ')[0]

  return (
    <div className={styles.wrap}>
      {/* ── Saudação ───────────────────────────────────────────────── */}
      <div className={styles.greetingRow}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>
            {saudacao()}, {primeiroPrimeiroNome}
          </h1>
          <p className={styles.greetingSub}>
            {hojeExtenso()}
            {contadores.total > 0 && ` · ${contadores.total} pessoa${contadores.total !== 1 ? 's' : ''} sob sua gestão`}
          </p>
        </div>
        {switcherNode && <div>{switcherNode}</div>}
      </div>

      {/* ── Linha principal: presença + fechamento ────────────────── */}
      <div className={styles.mainRow}>
        {/* Presença agora */}
        <div className={styles.presencaCard}>
          <div className={styles.presencaHead}>
            <div>
              <p className={styles.presencaTitulo}>Presença agora · {me.departamento_nome ?? 'Time'}</p>
              <p className={styles.presencaSub}>
                {contadores.total} pessoas
                {loadingTeam ? ' · carregando…' : ' · atualizado há instantes'}
              </p>
            </div>
            <Link to="/relatorios" className={styles.exportarBtn}>Exportar</Link>
          </div>

          {/* Contadores */}
          <div className={styles.contadores}>
            <div className={styles.contador}>
              <p className={styles.contadorLabel}>Trabalhando</p>
              <p className={styles.contadorValor}>
                <span className={styles.contadorNum}>{contadores.trabalhando}</span>
                <span className={styles.contadorTotal}>/{contadores.total}</span>
              </p>
            </div>
            <div className={styles.contador}>
              <p className={styles.contadorLabel}>Intervalo</p>
              <p className={styles.contadorValor}>
                <span className={styles.contadorNum}>{contadores.intervalo}</span>
                <span className={styles.contadorTotal}>/{contadores.total}</span>
              </p>
            </div>
            <div className={styles.contador}>
              <p className={styles.contadorLabel}>Folga</p>
              <p className={styles.contadorValor}>
                <span className={styles.contadorNum}>{contadores.folga}</span>
                <span className={styles.contadorTotal}>/{contadores.total}</span>
              </p>
            </div>
            <div className={styles.contador}>
              <p className={styles.contadorLabel}>Faltas</p>
              <p className={styles.contadorValor}>
                <span className={styles.contadorNum} style={{ color: contadores.falta > 0 ? '#ef4444' : undefined }}>
                  {contadores.falta}
                </span>
                <span className={styles.contadorTotal}>/{contadores.total}</span>
              </p>
            </div>
          </div>

          {teamError ? (
            <p className={styles.errorMsg} role="alert">{teamError}</p>
          ) : loadingTeam ? (
            <p className={styles.loadingMsg}>Carregando equipe…</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Status</th>
                    <th>Última batida</th>
                    <th>Saldo mês</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {team.map(({ funcionario: f, espelho: esp, loading: ld }) => {
                    const dia = esp?.dias.find((d) => d.data === hojeStr)
                    const status = statusPresenca(dia, hojeStr)
                    const ultima = ultimaBatidaHora(dia)
                    const saldo = esp ? formatSaldoMesPt(esp.resumo.saldo_mes_minutos) : '…'
                    const saldoNeg = esp && (esp.resumo.saldo_mes_minutos ?? 0) < 0

                    return (
                      <tr key={f.id}>
                        <td>
                          <div className={styles.pessoa}>
                            <span className={styles.avatar}>{initials(f.nome)}</span>
                            <div>
                              <p className={styles.pessoaNome}>{f.nome}</p>
                              <p className={styles.pessoaSub}>
                                {[f.departamento_nome, f.cargo].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {ld ? (
                            <span className={`${styles.statusBadge} ${styles.statusAguardando}`}>…</span>
                          ) : (
                            <span className={`${styles.statusBadge} ${styles['status' + status.variant.charAt(0).toUpperCase() + status.variant.slice(1)]}`}>
                              {status.label}
                            </span>
                          )}
                        </td>
                        <td className={styles.tdMuted}>{ld ? '…' : ultima}</td>
                        <td className={saldoNeg ? styles.tdNeg : styles.tdPos}>{saldo}</td>
                        <td>
                          <Link
                            to={`/espelho?funcionario_id=${f.id}`}
                            className={styles.rowChev}
                            aria-label={`Ver espelho de ${f.nome}`}
                          >›</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Fechamento */}
        {fechamento && (
          <div className={styles.fechamentoCard}>
            <p className={styles.fechamentoKicker}>FECHAMENTO</p>
            <h2 className={styles.fechamentoTitulo}>
              Folha de {fechamento.mesNome}/{myEspelho?.ano}
            </h2>
            <p className={styles.fechamentoSub}>
              Encerra em {fechamento.diasRestantes} dias
              {' '}· {new Date(myEspelho!.ano, myEspelho!.mes, 0).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </p>

            <div className={styles.fechamentoItem}>
              <div className={styles.fechamentoItemHead}>
                <span>Funcionários completos</span>
                <span>{fechamento.completos} / {fechamento.total}</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: fechamento.total > 0 ? `${(fechamento.completos / fechamento.total) * 100}%` : '0%',
                    background: '#4ade80',
                  }}
                />
              </div>
            </div>

            <div className={styles.fechamentoItem}>
              <div className={styles.fechamentoItemHead}>
                <span>Pendências em aberto</span>
                <span style={{ color: fechamento.pendencias > 0 ? '#ef4444' : undefined }}>
                  {fechamento.pendencias}
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: fechamento.total > 0 ? `${(fechamento.pendencias / fechamento.total) * 100}%` : '0%',
                    background: '#ef4444',
                  }}
                />
              </div>
            </div>

            <Link to="/relatorios" className={styles.fechamentoBtn}>
              Revisar e fechar →
            </Link>
          </div>
        )}
      </div>

      {/* ── Linha inferior: heatmap + fila de aprovação ───────────── */}
      <div className={styles.bottomRow}>
        {/* Heatmap */}
        <div className={styles.bottomCard}>
          <div className={styles.bottomCardHead}>
            <div>
              <p className={styles.bottomCardTitulo}>Presença · últimos 30 dias</p>
              <p className={styles.bottomCardSub}>% do time que bateu ponto no dia</p>
            </div>
            <Link to="/relatorios" className={styles.abrirRelatorio}>Abrir relatório →</Link>
          </div>

          <div className={styles.heatmap}>
            {heatmap.map(({ dia, pct, futuro }) => (
              <div
                key={dia}
                className={styles.heatCell}
                title={futuro ? `Dia ${dia}` : `Dia ${dia}: ${pct}% presença`}
                style={{
                  background: futuro
                    ? 'var(--sp-bg-canvas)'
                    : pct === 0
                      ? 'var(--sp-bg-canvas)'
                      : pct < 40
                        ? '#d4f0ed'
                        : pct < 70
                          ? '#7dd4ce'
                          : '#14918b',
                  opacity: futuro ? 0.4 : 1,
                }}
              >
                {dia}
              </div>
            ))}
          </div>

          <div className={styles.heatmapLegenda}>
            <span className={styles.heatmapLegendaLabel}>Menos</span>
            {['var(--sp-bg-canvas)', '#d4f0ed', '#7dd4ce', '#14918b'].map((c, i) => (
              <span key={i} className={styles.heatLegDot} style={{ background: c }} />
            ))}
            <span className={styles.heatmapLegendaLabel}>Mais</span>
          </div>
        </div>

        {/* Fila de aprovação */}
        <div className={styles.bottomCard}>
          <div className={styles.bottomCardHead}>
            <div>
              <p className={styles.bottomCardTitulo}>
                Ocorrências do mês
                {filaAprovacao.length > 0 && (
                  <span className={styles.badgeCount}>{ocorrencias.length}</span>
                )}
              </p>
              <p className={styles.bottomCardSub}>Lançamentos registrados</p>
            </div>
          </div>

          {filaAprovacao.length === 0 ? (
            <p className={styles.emptyMsg}>Nenhuma ocorrência este mês.</p>
          ) : (
            <ul className={styles.filaList}>
              {filaAprovacao.map((oc) => (
                <li key={oc.id} className={styles.filaItem}>
                  <div className={styles.filaInfo}>
                    <p className={styles.filaNome}>{oc.funcionario_nome}</p>
                    <p className={styles.filaSub}>
                      {oc.tipo_ocorrencia_descricao ?? oc.tipo} · {formatDataCurta(oc.data_inicio)}
                      {oc.descricao ? ` · há instantes` : ''}
                    </p>
                  </div>
                  <div className={styles.filaAcoes}>
                    <Link to="/relatorios" className={styles.filaAcaoOk} title="Ver detalhes">✓</Link>
                    <Link to="/ocorrencias" className={styles.filaAcaoCancel} title="Lançar nova">✕</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
