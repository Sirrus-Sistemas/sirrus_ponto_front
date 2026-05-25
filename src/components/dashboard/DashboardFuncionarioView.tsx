import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseDataHoraUtc } from '../../lib/parseDataHora'
import type { EspelhoPayload, DiaEspelho } from '../../services/espelhoApi'
import type { FuncionarioMe } from '../../services/userApi'
import {
  hojeIsoPtBr,
  formatMinutosPt,
  formatSaldoMesPt,
  proximaAcaoLabel,
  normalizarBatidasEsperadas,
} from './dashboardDiaUtils'
import styles from './DashboardFuncionarioView.module.css'

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

function nowHHmm(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
}

function mySqlTimeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const s = String(t).trim()
  const [hStr, mStr] = s.split(':')
  const h = parseInt(hStr ?? '', 10)
  const m = parseInt(mStr ?? '', 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function nowMinutes(): number {
  const d = new Date()
  const sp = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return sp.getHours() * 60 + sp.getMinutes()
}

function pctOnRange(val: number, start: number, end: number): number {
  if (end <= start) return 0
  return Math.max(0, Math.min(100, ((val - start) / (end - start)) * 100))
}

function expectedTimesFromMe(me: FuncionarioMe, batidas: number): Array<string | null | undefined> {
  const b = normalizarBatidasEsperadas(batidas)
  if (b === 2) return [me.turno_entrada, me.turno_saida]
  if (b >= 4) return [me.turno_entrada, me.turno_saida_intervalo, me.turno_retorno_intervalo, me.turno_saida]
  return [me.turno_entrada, me.turno_saida]
}

function nextExpectedTime(
  me: FuncionarioMe,
  nBatidas: number,
  batidas: number,
): string | null {
  const times = expectedTimesFromMe(me, batidas)
  const b = normalizarBatidasEsperadas(batidas)
  const idx = nBatidas % b
  const raw = times[idx]
  return raw ? String(raw).slice(0, 5) : null
}

function ultimaMarcacaoDoDia(dia: DiaEspelho | undefined) {
  if (!dia?.marcacoes.length) return null
  return [...dia.marcacoes].sort((a, b) => a.data_hora.localeCompare(b.data_hora)).at(-1) ?? null
}

function proxFeriadoFuturo(espelho: EspelhoPayload): { data: string; descricao: string } | null {
  const hoje = hojeIsoPtBr()
  for (const d of espelho.dias) {
    if (d.data > hoje && d.feriado) return { data: d.data, descricao: d.feriado.descricao }
  }
  return null
}

function diasPendentes(espelho: EspelhoPayload) {
  const hoje = hojeIsoPtBr()
  return espelho.dias
    .filter((d) => d.data < hoje && (d.incompleto || d.status === 'falta'))
    .slice(-5)
    .reverse()
}

type BatidaRecente = { data_hora: string; tipo_label: string; data: string; via?: string }

function batidasRecentes(espelho: EspelhoPayload, limit = 5): BatidaRecente[] {
  const resultado: BatidaRecente[] = []
  const diasOrdenados = [...espelho.dias].sort((a, b) => b.data.localeCompare(a.data))
  for (const dia of diasOrdenados) {
    for (const m of [...dia.marcacoes].sort((a, b) => b.data_hora.localeCompare(a.data_hora))) {
      resultado.push({ data_hora: m.data_hora, tipo_label: m.tipo_label, data: dia.data })
      if (resultado.length >= limit) return resultado
    }
  }
  return resultado
}

function feriadoDistancia(dataIso: string): string {
  const [y, mo, d] = dataIso.split('-').map(Number)
  const alvo = new Date(y!, mo! - 1, d!)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  return `${diff} dias`
}

function formatDataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function diaSemanaAbrev(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  return dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

function pendenteTitulo(dia: DiaEspelho): string {
  if (dia.status === 'falta') return 'Falta sem justificativa'
  if (dia.incompleto) {
    const n = dia.marcacoes.length
    if (n % 2 !== 0) return 'Batidas ímpares'
    return 'Batidas ímpares'
  }
  return 'Pendência'
}

function pendenteSub(dia: DiaEspelho): string {
  const n = dia.marcacoes.length
  return `${formatDataCurta(dia.data)} · ${diaSemanaAbrev(dia.data).charAt(0).toUpperCase() + diaSemanaAbrev(dia.data).slice(1)} · ${n} batida${n !== 1 ? 's' : ''}`
}

function mesExtenso(espelho: EspelhoPayload): string {
  const dt = new Date(espelho.ano, espelho.mes - 1, 1)
  return dt.toLocaleDateString('pt-BR', { month: 'long' })
}

function pctMesPercorrido(espelho: EspelhoPayload): number {
  const hoje = hojeIsoPtBr()
  const [, , dStr] = hoje.split('-')
  const d = parseInt(dStr ?? '1', 10)
  const totalDias = new Date(espelho.ano, espelho.mes, 0).getDate()
  return Math.round((d / totalDias) * 100)
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Timeline({
  me,
  dia,
  batidasTurno,
  tick,
}: {
  me: FuncionarioMe
  dia: DiaEspelho | undefined
  batidasTurno: number | null
  tick: number
}) {
  const startMin = mySqlTimeToMinutes(me.turno_entrada) ?? 480   // 08:00
  const endMin = mySqlTimeToMinutes(me.turno_saida) ?? 1020       // 17:00
  const now = nowMinutes()
  const nowPct = pctOnRange(now, startMin, endMin)

  const expectedTimes = expectedTimesFromMe(me, batidasTurno ?? 4)
  const markers = expectedTimes
    .map((t) => {
      const min = mySqlTimeToMinutes(t)
      if (min == null) return null
      return { pct: pctOnRange(min, startMin, endMin), label: String(t).slice(0, 5) }
    })
    .filter(Boolean) as { pct: number; label: string }[]

  const batidasDoDia = dia?.marcacoes ?? []
  const batidaDots = batidasDoDia.map((m) => {
    try {
      const dt = parseDataHoraUtc(m.data_hora)
      const sp = new Date(dt.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const min = sp.getHours() * 60 + sp.getMinutes()
      return { pct: pctOnRange(min, startMin, endMin), label: String(m.tipo_label) }
    } catch {
      return null
    }
  }).filter(Boolean) as { pct: number; label: string }[]

  void tick // consumed to trigger re-render on tick

  return (
    <div className={styles.timelineWrap}>
      <div className={styles.timelineBar}>
        {/* fill até agora */}
        <div className={styles.timelineFill} style={{ width: `${nowPct}%` }} />

        {/* dots das batidas reais */}
        {batidaDots.map((d, i) => (
          <div key={i} className={styles.timelineDot} style={{ left: `${d.pct}%` }} title={d.label} />
        ))}

        {/* marcador de agora */}
        <div className={styles.timelineNowLine} style={{ left: `${nowPct}%` }}>
          <span className={styles.timelineNowLabel}>{nowHHmm()}</span>
        </div>
      </div>

      {/* labels de tempo abaixo */}
      <div className={styles.timelineLabels}>
        {markers.map((m, i) => (
          <span key={i} className={styles.timelineLabel} style={{ left: `${m.pct}%` }}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────

type Props = {
  me: FuncionarioMe
  espelho: EspelhoPayload
  onRegistrar: () => void
  registering: boolean
  registerError: string | null
  switcherNode?: React.ReactNode
}

export function DashboardFuncionarioView({ me, espelho, onRegistrar, registering, registerError, switcherNode }: Props) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30000)
    return () => window.clearInterval(id)
  }, [])

  const hojeStr = useMemo(() => hojeIsoPtBr(), [tick])
  const dia = useMemo(() => espelho.dias.find((d) => d.data === hojeStr), [espelho, hojeStr])
  const batidasTurno = espelho.meta.batidas_esperadas_dia ?? me.turno_batidas_esperadas_dia ?? null

  const nBatidas = dia?.marcacoes.length ?? 0
  const proximaAcao = proximaAcaoLabel(nBatidas, batidasTurno)
    .replace('Bater ', '')
  const previstaHHmm = nextExpectedTime(me, nBatidas, batidasTurno ?? 4)

  const ultimaBatida = ultimaMarcacaoDoDia(dia)
  const ultimaBatidaHora = useMemo(() => {
    if (!ultimaBatida) return null
    try { return formatHHmm(parseDataHoraUtc(ultimaBatida.data_hora)) } catch { return null }
  }, [ultimaBatida])

  const feriado = proxFeriadoFuturo(espelho)
  const pendentes = useMemo(() => diasPendentes(espelho), [espelho])
  const recentes = useMemo(() => batidasRecentes(espelho), [espelho])

  const mes = mesExtenso(espelho)
  const pctMes = pctMesPercorrido(espelho)
  const extras100 = espelho.resumo.total_extras_100pct_minutos

  const hojeExtensoStr = useMemo(() => hojeExtenso(), [tick])

  const turnoNome = espelho.meta.turno_nome?.trim() ?? me.turno_nome?.trim() ?? null

  return (
    <div className={styles.wrap}>
      {/* ── Saudação ─────────────────────────────────────────────── */}
      <div className={styles.greetingRow}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>
            {saudacao()}, {me.nome.split(' ')[0]} 👋
          </h1>
          <p className={styles.greetingSub}>
            {hojeExtensoStr}
            {turnoNome ? ` · ${turnoNome}` : ''}
          </p>
        </div>
        {switcherNode && <div>{switcherNode}</div>}
      </div>

      {/* ── Hero card ────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroKicker}>
            SUA JORNADA HOJE
            <span className={styles.heroKickerDate}>
              {' '}· {new Date().toLocaleDateString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                day: 'numeric',
                month: 'short',
                weekday: 'short',
              })}
            </span>
          </p>

          <h2 className={styles.heroTitle}>
            Próxima: {proximaAcao}
          </h2>

          {previstaHHmm && (
            <p className={styles.heroSub}>
              previsto <strong>{previstaHHmm}</strong>
              {ultimaBatidaHora && (
                <> · última batida <strong>{ultimaBatidaHora}</strong></>
              )}
            </p>
          )}

          <Timeline me={me} dia={dia} batidasTurno={batidasTurno} tick={tick} />

          <div className={styles.heroBtns}>
            <button
              type="button"
              className={styles.btnBater}
              onClick={onRegistrar}
              disabled={registering}
            >
              <ClockIcon />
              {registering ? 'Registrando…' : 'Bater ponto agora'}
            </button>
            <Link to="/ficha-ponto" className={styles.btnSecundario}>
              Esqueci uma batida
            </Link>
          </div>

          {registerError && (
            <p className={styles.registerError} role="alert">{registerError}</p>
          )}
        </div>

        <div className={styles.heroRight}>
          <p className={styles.heroDonutLabel}>TRABALHADO HOJE</p>
          <div className={styles.heroDonut}>
            <DonutHero
              trabalhados={dia?.minutos_trabalhados ?? 0}
              previstos={dia?.minutos_previstos ?? null}
            />
          </div>
          {dia?.minutos_previstos != null && (
            <p className={styles.heroDonutSub}>
              de {formatMinutosPt(dia.minutos_previstos)} previstas
            </p>
          )}
          <div className={styles.heroLegend}>
            <span className={styles.legendDot} style={{ background: '#4ade80' }} /> Realizado
            <span className={styles.legendDotSpacer} />
            <span className={styles.legendDot} style={{ background: 'rgba(255,255,255,0.2)' }} /> A cumprir
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statCardAccent} style={{ background: '#ef4444' }} />
          <p className={styles.statKicker}>Saldo do mês</p>
          <p className={styles.statMain} style={{ color: espelho.resumo.saldo_mes_minutos != null && espelho.resumo.saldo_mes_minutos < 0 ? '#ef4444' : '#14918b' }}>
            {formatSaldoMesPt(espelho.resumo.saldo_mes_minutos)}
          </p>
          <p className={styles.statSub}>
            {mes} · {pctMes}% percorrido
          </p>
          <div className={styles.statProgressTrack}>
            <div className={styles.statProgressFill} style={{ width: `${pctMes}%`, background: '#14918b' }} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardAccent} style={{ background: '#3b82f6' }} />
          <p className={styles.statKicker}>Marcações no mês</p>
          <p className={styles.statMain} style={{ color: 'var(--sp-text)' }}>
            {espelho.resumo.total_marcacoes}
          </p>
          {ultimaBatida && ultimaBatidaHora && (
            <p className={styles.statSub}>Última: {hojeStr} · {ultimaBatidaHora}</p>
          )}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardAccent} style={{ background: '#f59e0b' }} />
          <p className={styles.statKicker}>Extras 100%</p>
          <p className={styles.statMain} style={{ color: extras100 > 0 ? '#f59e0b' : 'var(--sp-text)' }}>
            {extras100 > 0 ? `+${formatMinutosPt(extras100)}` : '0h 00m'}
          </p>
          {espelho.resumo.total_extras_50pct_minutos > 0 && (
            <p className={styles.statSub}>
              Pendente aprovação: {formatMinutosPt(espelho.resumo.total_extras_50pct_minutos)}
            </p>
          )}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardAccent} style={{ background: '#8b5cf6' }} />
          <p className={styles.statKicker}>Próximo feriado</p>
          {feriado ? (
            <>
              <p className={styles.statMain} style={{ color: 'var(--sp-text)' }}>
                {formatDataCurta(feriado.data).replace('/', '/').split('/').map((p, i) => i === 0 ? p.padStart(2, '0') : p).join('/')}
              </p>
              <p className={styles.statSub}>
                {feriado.descricao} · {feriadoDistancia(feriado.data)}
              </p>
            </>
          ) : (
            <p className={styles.statMain} style={{ color: 'var(--sp-text-3)' }}>—</p>
          )}
        </div>
      </div>

      {/* ── Bottom: pendentes + batidas recentes ─────────────────── */}
      <div className={styles.bottomRow}>
        <div className={styles.bottomCard}>
          <div className={styles.bottomCardHead}>
            <p className={styles.bottomCardTitle}>
              Pendentes de você
              {pendentes.length > 0 && (
                <span className={styles.badge}>{pendentes.length}</span>
              )}
            </p>
            <Link to="/espelho" className={styles.verTodos}>Ver todos →</Link>
          </div>

          {pendentes.length === 0 ? (
            <p className={styles.emptyMsg}>Nenhuma pendência encontrada 🎉</p>
          ) : (
            <ul className={styles.pendentesList}>
              {pendentes.map((d) => (
                <li key={d.data} className={styles.pendente}>
                  <span className={styles.pendenteData}>{formatDataCurta(d.data)}</span>
                  <div className={styles.pendenteCentro}>
                    <p className={styles.pendenteTitulo}>{pendenteTitulo(d)}</p>
                    <p className={styles.pendenteSub}>{pendenteSub(d)}</p>
                  </div>
                  <Link to="/espelho" className={styles.resolverBtn}>Resolver →</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.bottomCard}>
          <div className={styles.bottomCardHead}>
            <p className={styles.bottomCardTitle}>Batidas recentes</p>
            <Link to="/espelho" className={styles.verTodos}>Ver tudo →</Link>
          </div>

          {recentes.length === 0 ? (
            <p className={styles.emptyMsg}>Nenhuma batida registrada ainda.</p>
          ) : (
            <ul className={styles.recentesList}>
              {recentes.map((b, i) => (
                <li key={i} className={styles.recente}>
                  <span className={styles.recenteDot} />
                  <div className={styles.recenteCentro}>
                    <p className={styles.recenteTipo}>{b.tipo_label}</p>
                    <p className={styles.recenteData}>
                      {formatDataCurta(b.data)} · {diaSemanaAbrev(b.data).charAt(0).toUpperCase() + diaSemanaAbrev(b.data).slice(1)}
                      {b.via ? ` · via ${b.via}` : ' · via App'}
                    </p>
                  </div>
                  <span className={styles.recenteHora}>
                    {(() => {
                      try { return formatHHmm(parseDataHoraUtc(b.data_hora)) } catch { return '—' }
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Donut SVG ────────────────────────────────────────────────────────────────

function DonutHero({ trabalhados, previstos }: { trabalhados: number; previstos: number | null }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const pct = previstos && previstos > 0 ? Math.min(1, trabalhados / previstos) : (trabalhados > 0 ? 1 : 0)
  const dash = pct * circ
  const gap = circ - dash

  const hh = Math.floor(trabalhados / 60)
  const mm = trabalhados % 60

  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
      {pct > 0 && (
        <circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke="#4ade80"
          strokeWidth="8"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
      )}
      <text x="55" y="50" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">
        {hh}h {String(mm).padStart(2, '0')}m
      </text>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
