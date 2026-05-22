import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import type { EspelhoPayload } from '../../services/espelhoApi'
import type { FuncionarioListItem } from '../../services/funcionariosApi'
import styles from './EspelhoHeader.module.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelMes(m: number): string {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function getInitials(nome: string | null): string {
  if (!nome) return '?'
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function saldoHumanizado(saldoMin: number, minPorDia: number): string {
  if (saldoMin === 0) return 'Em dia'
  const absMin = Math.abs(saldoMin)
  const diaMin = minPorDia > 0 ? minPorDia : 480
  const dias = absMin / diaMin
  const inteiros = Math.floor(dias)
  const resto = dias - inteiros
  let desc = inteiros > 0 ? `${inteiros} dia${inteiros > 1 ? 's' : ''}` : ''
  if (resto >= 0.35 && resto < 0.7) {
    desc += desc ? ' e meio' : 'meio dia'
  }
  if (!desc) desc = 'algumas horas'
  return saldoMin < 0 ? `Devendo ${desc} de trabalho` : `Adiantado ${desc} de trabalho`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmployeeAvatar({ nome }: { nome: string | null }) {
  return (
    <div className={styles.avatar} aria-label={nome ?? 'Funcionário'}>
      {nome ? getInitials(nome) : '?'}
    </div>
  )
}

type SaldoVariant = 'positive' | 'negative' | 'neutral'

type MonthStepperProps = {
  mes: number
  ano: number
  meses: { value: number; label: string }[]
  anos: number[]
  saldoVariant: SaldoVariant
  onChange: (mes: number, ano: number) => void
}

function MonthStepper({ mes, ano, meses, anos, saldoVariant, onChange }: MonthStepperProps) {
  const [open, setOpen] = useState(false)
  const [tempMes, setTempMes] = useState(mes)
  const [tempAno, setTempAno] = useState(ano)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function prev() {
    if (mes === 1) onChange(12, ano - 1)
    else onChange(mes - 1, ano)
  }

  function next() {
    if (mes === 12) onChange(1, ano + 1)
    else onChange(mes + 1, ano)
  }

  function openFull() {
    setTempMes(mes)
    setTempAno(ano)
    setOpen(true)
  }

  function confirm() {
    onChange(tempMes, tempAno)
    setOpen(false)
  }

  return (
    <div className={styles.monthStepper} ref={ref}>
      <button type="button" className={styles.stepperArrow} onClick={prev} aria-label="Mês anterior">
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <button type="button" className={styles.stepperLabel} onClick={openFull}>
        {saldoVariant !== 'neutral' && (
          <span
            className={`${styles.statusDot} ${saldoVariant === 'positive' ? styles.statusDotPositive : styles.statusDotNegative}`}
            aria-hidden="true"
          />
        )}
        {labelMes(mes)} {ano}
      </button>
      <button type="button" className={styles.stepperArrow} onClick={next} aria-label="Próximo mês">
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.stepperDropdown}>
          <div className={styles.stepperDropdownRow}>
            <div className={styles.stepperField}>
              <label>Mês</label>
              <select value={tempMes} onChange={(e) => setTempMes(Number(e.target.value))}>
                {meses.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.stepperField}>
              <label>Ano</label>
              <select value={tempAno} onChange={(e) => setTempAno(Number(e.target.value))}>
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="button" className={styles.stepperConfirm} onClick={confirm}>
            Ver
          </button>
        </div>
      )}
    </div>
  )
}

function MetricCardSaldo({
  saldoMin,
  previstoMesMin,
  minPorDia,
}: {
  saldoMin: number | null
  previstoMesMin: number
  minPorDia: number
}) {
  // previstoMesMin used for future tooltip/humanization context
  void previstoMesMin
  const variant: SaldoVariant =
    saldoMin === null || saldoMin === 0 ? 'neutral' : saldoMin < 0 ? 'negative' : 'positive'
  const abs = saldoMin === null ? 0 : Math.abs(saldoMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sign = variant === 'negative' ? '−' : variant === 'positive' ? '+' : ''
  const Icon = variant === 'negative' ? TrendingDown : TrendingUp

  const cardClass = variant === 'positive'
    ? styles.metricCard_positive
    : variant === 'negative'
    ? styles.metricCard_negative
    : styles.metricCard_neutral

  const labelClass = variant === 'positive'
    ? styles.metricLabel_positive
    : variant === 'negative'
    ? styles.metricLabel_negative
    : styles.metricLabel_neutral

  const heroClass = variant === 'positive'
    ? styles.metricValueHero_positive
    : variant === 'negative'
    ? styles.metricValueHero_negative
    : styles.metricValueHero_neutral

  const subClass = variant === 'positive'
    ? styles.metricValueSub_positive
    : variant === 'negative'
    ? styles.metricValueSub_negative
    : styles.metricValueSub_neutral

  const humanClass = variant === 'positive'
    ? styles.saldoHuman_positive
    : variant === 'negative'
    ? styles.saldoHuman_negative
    : styles.saldoHuman_neutral

  return (
    <div className={`${styles.metricCard} ${cardClass}`}>
      <p className={`${styles.metricLabel} ${labelClass}`}>
        <Icon size={14} aria-hidden="true" />
        SALDO DO MÊS
      </p>
      {saldoMin === null ? (
        <p className={`${styles.metricValueHero} ${styles.metricValueHero_neutral}`}>—</p>
      ) : (
        <div className={styles.saldoValueRow}>
          <span className={`${styles.metricValueHero} ${heroClass}`}>
            {sign}{h}h
          </span>
          {m > 0 && (
            <span className={`${styles.metricValueSub} ${subClass}`}>
              {m}min
            </span>
          )}
        </div>
      )}
      {saldoMin !== null && (
        <p className={`${styles.saldoHuman} ${humanClass}`}>
          {saldoHumanizado(saldoMin, minPorDia)}
        </p>
      )}
    </div>
  )
}

function MetricCardTrabalhado({
  trabalhadoMin,
  previstoMesMin,
}: {
  trabalhadoMin: number
  previstoMesMin: number
}) {
  const pct = previstoMesMin > 0 ? Math.min(trabalhadoMin / previstoMesMin, 1) : 0
  const barWidth = Math.max(pct * 100, pct > 0 ? 2 : 0)

  return (
    <div className={`${styles.metricCard} ${styles.metricCard_neutral}`}>
      <p className={`${styles.metricLabel} ${styles.metricLabel_neutral}`}>
        <Clock size={14} aria-hidden="true" />
        TRABALHADO
      </p>
      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{formatMin(trabalhadoMin)}</span>
        {previstoMesMin > 0 && (
          <span className={styles.metricValueInline}>de {formatMin(previstoMesMin)} previstas</span>
        )}
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  )
}

function MetricCardPresenca({
  presentes,
  faltas,
  incompletos,
}: {
  presentes: number
  faltas: number
  incompletos: number
}) {
  const diasUteis = presentes + faltas + incompletos

  return (
    <div className={`${styles.metricCard} ${styles.metricCard_neutral}`}>
      <p className={`${styles.metricLabel} ${styles.metricLabel_neutral}`}>
        <Calendar size={14} aria-hidden="true" />
        PRESENÇA
      </p>
      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{presentes}</span>
        <span className={styles.metricValueInline}>de {diasUteis} dias úteis</span>
      </div>
      <div className={styles.splitBar}>
        {diasUteis > 0 ? (
          <>
            <div className={styles.splitBarPresente} style={{ flex: presentes }} />
            {faltas > 0 && <div className={styles.splitBarFalta} style={{ flex: faltas }} />}
            {incompletos > 0 && (
              <div className={styles.splitBarIncompleto} style={{ flex: incompletos }} />
            )}
          </>
        ) : (
          <div className={styles.splitBarEmpty} style={{ flex: 1 }} />
        )}
      </div>
    </div>
  )
}

type ChipVariant = 'falta' | 'incompleto' | 'extra' | 'ocorrencia'

function MetricChip({
  icon,
  value,
  label,
  variant,
}: {
  icon: ReactNode
  value: string | number
  label: string
  variant: ChipVariant
}) {
  const chipClass = variant === 'falta'
    ? styles.chip_falta
    : variant === 'incompleto'
    ? styles.chip_incompleto
    : variant === 'extra'
    ? styles.chip_extra
    : styles.chip_ocorrencia

  return (
    <span className={`${styles.chip} ${chipClass}`}>
      <span className={styles.chipIcon} aria-hidden="true">{icon}</span>
      <span className={styles.chipValue}>{value}</span>
      <span className={styles.chipLabel}> {label}</span>
    </span>
  )
}

// ─── Main EspelhoHeader ───────────────────────────────────────────────────────

export type EspelhoHeaderProps = {
  data: EspelhoPayload | null
  mes: number
  ano: number
  meses: { value: number; label: string }[]
  anos: number[]
  podeVerOutros: boolean
  funcionarios: FuncionarioListItem[]
  selectedFuncId: number | null
  onMesChange: (mes: number) => void
  onAnoChange: (ano: number) => void
  onFuncChange: (id: number | null) => void
}

export function EspelhoHeader({
  data,
  mes,
  ano,
  meses,
  anos,
  podeVerOutros,
  funcionarios,
  selectedFuncId,
  onMesChange,
  onAnoChange,
  onFuncChange,
}: EspelhoHeaderProps) {
  const previstoMesMin = data
    ? data.dias.reduce((acc, d) => acc + (d.minutos_previstos ?? 0), 0)
    : 0

  const saldo = data?.resumo.saldo_mes_minutos ?? null
  const saldoVariant: SaldoVariant =
    saldo === null || saldo === 0 ? 'neutral' : saldo < 0 ? 'negative' : 'positive'

  function handleMonthChange(newMes: number, newAno: number) {
    onMesChange(newMes)
    onAnoChange(newAno)
  }

  return (
    <div className={styles.header}>
      {/* ── Nível 0: Identificação ─────────────────────────────────── */}
      <div className={styles.identRow}>
        <EmployeeAvatar nome={data?.meta.funcionario_nome ?? null} />
        <div className={styles.employeeInfo}>
          <p className={styles.employeeName}>
            {data?.meta.funcionario_nome ?? 'Espelho de Ponto'}
          </p>
          <p className={styles.employeeMeta}>
            {data
              ? [
                  data.meta.turno_nome,
                  data.meta.minutos_previsto_dia_referencia != null
                    ? `Previsto ${formatMin(data.meta.minutos_previsto_dia_referencia)}/dia`
                    : null,
                  `${labelMes(mes)} de ${ano}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `${labelMes(mes)} de ${ano}`}
          </p>
        </div>
        <div className={styles.headerRight}>
          <MonthStepper
            mes={mes}
            ano={ano}
            meses={meses}
            anos={anos}
            saldoVariant={saldoVariant}
            onChange={handleMonthChange}
          />
          <button
            type="button"
            className={styles.pdfBtn}
            onClick={() => window.print()}
            aria-label="Imprimir ou salvar como PDF"
          >
            <Download size={14} aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>

      {/* ── Seletor de funcionário (gestores/admins) ─────────────── */}
      {podeVerOutros && funcionarios.length > 0 && (
        <div className={styles.funcRow}>
          <label htmlFor="espelho-func-hdr" className={styles.funcLabel}>
            Funcionário
          </label>
          <select
            id="espelho-func-hdr"
            className={styles.funcSelect}
            value={selectedFuncId ?? ''}
            onChange={(e) =>
              onFuncChange(e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">Meu espelho</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Níveis 1 e 2: Métricas (apenas com dados) ────────────── */}
      {data && (
        <>
          <div className={styles.metricsGrid}>
            <MetricCardSaldo
              saldoMin={data.resumo.saldo_mes_minutos}
              previstoMesMin={previstoMesMin}
              minPorDia={data.meta.minutos_previsto_dia_referencia ?? 480}
            />
            <MetricCardTrabalhado
              trabalhadoMin={data.resumo.minutos_trabalhados_mes}
              previstoMesMin={previstoMesMin}
            />
            <MetricCardPresenca
              presentes={data.resumo.dias_presentes}
              faltas={data.resumo.dias_falta}
              incompletos={data.resumo.dias_incompletos}
            />
          </div>

          <div className={styles.chipsRow}>
            {data.resumo.dias_falta > 0 && (
              <MetricChip
                icon={<AlertTriangle size={12} />}
                value={data.resumo.dias_falta}
                label="faltas"
                variant="falta"
              />
            )}
            {data.resumo.dias_incompletos > 0 && (
              <MetricChip
                icon={<Clock size={12} />}
                value={data.resumo.dias_incompletos}
                label="dias incompletos"
                variant="incompleto"
              />
            )}
            {data.resumo.total_extras_100pct_minutos > 0 && (
              <MetricChip
                icon={<Plus size={12} />}
                value={formatMin(data.resumo.total_extras_100pct_minutos)}
                label="extras 100%"
                variant="extra"
              />
            )}
            {data.resumo.total_extras_50pct_minutos > 0 && (
              <MetricChip
                icon={<Plus size={12} />}
                value={formatMin(data.resumo.total_extras_50pct_minutos)}
                label="extras 50%"
                variant="extra"
              />
            )}
            <MetricChip
              icon={<Calendar size={12} />}
              value={data.resumo.dias_ocorrencia}
              label="ocorrência(s)"
              variant="ocorrencia"
            />
          </div>
        </>
      )}
    </div>
  )
}
