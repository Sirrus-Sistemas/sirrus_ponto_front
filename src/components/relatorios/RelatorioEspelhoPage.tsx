import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { fetchEspelho, type EspelhoPayload, type StatusDia } from '../../services/espelhoApi'
import { formatHoraLocalPtBr } from '../../lib/parseDataHora'
import { normalizarBatidasEsperadas } from '../dashboard/dashboardDiaUtils'
import { EspelhoImpressao } from './EspelhoImpressao'
import styles from './RelatorioEspelhoPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function labelMes(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function formatMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${pad2(m)}m`
}

function formatSaldo(min: number | null): string {
  if (min === null) return '—'
  const sign = min >= 0 ? '+' : '−'
  return `${sign}${formatMinutos(Math.abs(min))}`
}

const STATUS_LABEL: Record<StatusDia, string> = {
  presente: 'Presente',
  falta: 'Falta',
  folga: 'Folga',
  feriado: 'Feriado',
  futuro: '—',
  sem_escala: 'S/ escala',
  ocorrencia: 'Ocorrência',
  atestado: 'Atestado',
  abono: 'Abono',
  falta_justificada: 'F. Justif.',
  licenca: 'Licença',
  outros: 'Ocorrência',
}

const STATUS_ROW: Partial<Record<StatusDia, string>> = {
  falta: styles.rowFalta,
  feriado: styles.rowFeriado,
  folga: styles.rowFolga,
  ocorrencia: styles.rowOcorrencia,
  atestado: styles.rowOcorrencia,
  abono: styles.rowOcorrencia,
  falta_justificada: styles.rowOcorrencia,
  licenca: styles.rowOcorrencia,
  outros: styles.rowOcorrencia,
}

const STATUS_BADGE: Partial<Record<StatusDia, string>> = {
  presente: styles.sBadgePresente,
  falta: styles.sBadgeFalta,
  folga: styles.sBadgeFolga,
  feriado: styles.sBadgeFeriado,
  sem_escala: styles.sBadgeSemEscala,
  ocorrencia: styles.sBadgeOcorrencia,
  atestado: styles.sBadgeOcorrencia,
  abono: styles.sBadgeOcorrencia,
  falta_justificada: styles.sBadgeOcorrencia,
  licenca: styles.sBadgeOcorrencia,
  outros: styles.sBadgeOcorrencia,
}

function obsRow(
  dia: EspelhoPayload['dias'][number],
  batidasTurno: number | null | undefined,
): string {
  if (dia.ocorrencia?.tipo_ocorrencia_descricao) return dia.ocorrencia.tipo_ocorrencia_descricao
  if (dia.ocorrencia?.descricao) return dia.ocorrencia.descricao
  if (dia.feriado) return dia.feriado.descricao
  if (dia.incompleto && dia.marcacoes.length) {
    const n = dia.marcacoes.length
    if (n % 2 === 1) return 'Batidas ímpares'
    if (dia.minutos_previstos != null && batidasTurno != null) {
      const b = normalizarBatidasEsperadas(batidasTurno)
      if (n % b !== 0) return `Ciclo incompleto (${n}/${b})`
    }
    return 'Pendência'
  }
  return ''
}

// ─── Bloco de espelho de um funcionário ──────────────────────────────────────

function EspelhoBlock({
  funcionario,
  espelho,
  periodo,
}: {
  funcionario: FuncionarioListItem
  espelho: EspelhoPayload
  periodo: string
}) {
  const { meta, resumo, dias } = espelho

  return (
    <section className={styles.block}>
      <div className={styles.blockHeader}>
        <div className={styles.blockEmployee}>
          <span className={styles.blockNome}>{funcionario.nome}</span>
          {funcionario.cargo ? (
            <span className={styles.blockSub}>{funcionario.cargo}</span>
          ) : null}
          {funcionario.lotacao_nome ? (
            <span className={styles.blockSub}>Lotação: {funcionario.lotacao_nome}</span>
          ) : null}
          {meta.turno_nome ? (
            <span className={styles.blockSub}>Turno: {meta.turno_nome}</span>
          ) : null}
        </div>
        <div className={styles.blockPeriodo}>
          <span className={styles.blockPeriodoLabel}>Espelho de ponto</span>
          <span className={styles.blockPeriodoVal}>{periodo}</span>
        </div>
      </div>

      <div className={styles.blockSummary}>
        <div className={styles.sc}>
          <p className={styles.scLabel}>Trabalhadas</p>
          <p className={styles.scVal}>{formatMinutos(resumo.minutos_trabalhados_mes)}</p>
        </div>
        <div className={styles.sc}>
          <p className={styles.scLabel}>Saldo</p>
          <p className={`${styles.scVal} ${styles.scMono}`}>{formatSaldo(resumo.saldo_mes_minutos)}</p>
        </div>
        <div className={styles.sc}>
          <p className={styles.scLabel}>Presentes</p>
          <p className={`${styles.scVal} ${styles.scPresente}`}>{resumo.dias_presentes}</p>
        </div>
        <div className={styles.sc}>
          <p className={styles.scLabel}>Faltas</p>
          <p className={`${styles.scVal} ${resumo.dias_falta ? styles.scFalta : ''}`}>
            {resumo.dias_falta}
          </p>
        </div>
        <div className={styles.sc}>
          <p className={styles.scLabel}>Folgas</p>
          <p className={styles.scVal}>{resumo.dias_folga}</p>
        </div>
        {resumo.dias_ocorrencia > 0 ? (
          <div className={styles.sc}>
            <p className={styles.scLabel}>Ocorrências</p>
            <p className={`${styles.scVal} ${styles.scOcorrencia}`}>{resumo.dias_ocorrencia}</p>
          </div>
        ) : null}
        <div className={styles.sc}>
          <p className={styles.scLabel}>Feriados</p>
          <p className={styles.scVal}>{meta.dias_feriado_calendario}</p>
        </div>
        {resumo.dias_incompletos > 0 ? (
          <div className={styles.sc}>
            <p className={styles.scLabel}>Incompletos</p>
            <p className={`${styles.scVal} ${styles.scWarn}`}>{resumo.dias_incompletos}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Status</th>
              <th>Entradas / saídas</th>
              <th>Trabalhadas</th>
              <th>Previsto</th>
              <th>Saldo</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((dia) => {
              const rowCls = [
                dia.incompleto && dia.marcacoes.length ? styles.rowWarn : '',
                STATUS_ROW[dia.status] ?? '',
              ]
                .filter(Boolean)
                .join(' ')

              const previsto =
                dia.feriado
                  ? 'Feriado'
                  : dia.minutos_previstos != null
                  ? formatMinutos(dia.minutos_previstos)
                  : '—'

              return (
                <tr key={dia.data} className={rowCls || undefined}>
                  <td className={styles.colDia}>
                    {dia.dia_semana_label} {dia.data.slice(8, 10)}/{dia.data.slice(5, 7)}
                  </td>
                  <td>
                    <span
                      className={`${styles.sBadge} ${STATUS_BADGE[dia.status] ?? ''}`}
                    >
                      {STATUS_LABEL[dia.status] ?? dia.status}
                    </span>
                  </td>
                  <td className={styles.colBatidas}>
                    {dia.marcacoes.length === 0
                      ? '—'
                      : dia.marcacoes.map((m, i) => (
                          <span key={m.id}>
                            {i > 0 ? ' · ' : null}
                            <span className={styles.tipoBadge}>{m.tipo_label}</span>
                            {formatHoraLocalPtBr(m.data_hora)}
                          </span>
                        ))}
                  </td>
                  <td className={styles.colNum}>
                    {dia.marcacoes.length ? formatMinutos(dia.minutos_trabalhados) : '—'}
                  </td>
                  <td className={styles.colNum}>{previsto}</td>
                  <td className={styles.colNum}>{formatSaldo(dia.saldo_minutos)}</td>
                  <td className={styles.colObs}>
                    {obsRow(dia, meta.batidas_esperadas_dia)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Escopo = 'empresa' | 'lotacao' | 'funcionario'

type EspelhoEntry = {
  funcionario: FuncionarioListItem
  espelho: EspelhoPayload
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function RelatorioEspelhoPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [escopo, setEscopo] = useState<Escopo>('funcionario')
  const [lotacaoId, setLotacaoId] = useState<number | null>(null)
  const [funcId, setFuncId] = useState<number | null>(null)

  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  const [entries, setEntries] = useState<EspelhoEntry[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    fetchLotacoes().then(setLotacoes).catch(() => {})
    fetchFuncionarios({ limit: 500, ativo: 1 })
      .then((r) => setFuncionarios(r.data))
      .catch(() => {})
  }, [])

  const anos = useMemo(() => {
    const y = now.getFullYear()
    return Array.from({ length: 5 }, (_, i) => y - 2 + i)
  }, [])

  const meses = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: labelMes(i + 1) })),
    [],
  )

  const periodo = `${labelMes(mes)} de ${ano}`

  const gerar = useCallback(async () => {
    setEntries([])
    setError(null)
    abortRef.current = false

    let lista: FuncionarioListItem[] = []

    if (escopo === 'empresa') {
      lista = funcionarios
    } else if (escopo === 'lotacao') {
      if (!lotacaoId) {
        setError('Selecione uma lotação.')
        return
      }
      lista = funcionarios.filter((f) => f.lotacao_id === lotacaoId)
    } else {
      if (!funcId) {
        setError('Selecione um funcionário.')
        return
      }
      lista = funcionarios.filter((f) => f.id === funcId)
    }

    if (!lista.length) {
      setError('Nenhum funcionário encontrado para o filtro informado.')
      return
    }

    setProgress({ done: 0, total: lista.length })

    const result: EspelhoEntry[] = []
    for (const func of lista) {
      if (abortRef.current) break
      try {
        const espelho = await fetchEspelho(ano, mes, func.id)
        result.push({ funcionario: func, espelho })
      } catch {
        // skip employee on error
      }
      if (!abortRef.current) {
        setProgress((p) => p ? { done: p.done + 1, total: p.total } : null)
      }
    }

    setProgress(null)
    setEntries(result)
  }, [escopo, lotacaoId, funcId, funcionarios, ano, mes])


  return (
    <div className={styles.wrap}>
      {/* ── Formulário de filtros ──────────────────────────────────── */}
      <div className={styles.form}>
        <div className={styles.formTitle}>
          <h1 className={styles.title}>Relatório — Espelho de Ponto</h1>
          <p className={styles.subtitle}>Gere e imprima espelhos por empresa, lotação ou funcionário.</p>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label>Mês</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {meses.map((m) => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Ano</label>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label>Escopo</label>
            <div className={styles.radioGroup}>
              {(['empresa', 'lotacao', 'funcionario'] as Escopo[]).map((s) => (
                <label key={s} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="escopo"
                    value={s}
                    checked={escopo === s}
                    onChange={() => setEscopo(s)}
                  />
                  {s === 'empresa' ? 'Toda a empresa' : s === 'lotacao' ? 'Por lotação' : 'Por funcionário'}
                </label>
              ))}
            </div>
          </div>

          {escopo === 'lotacao' ? (
            <div className={styles.field}>
              <label>Lotação</label>
              <select
                value={lotacaoId ?? ''}
                onChange={(e) => setLotacaoId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione…</option>
                {lotacoes.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          ) : escopo === 'funcionario' ? (
            <div className={styles.field}>
              <label>Funcionário</label>
              <select
                value={funcId ?? ''}
                onChange={(e) => setFuncId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione…</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {error ? <p className={styles.errorMsg}>{error}</p> : null}

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btnGerar}
            onClick={() => void gerar()}
            disabled={progress !== null}
          >
            {progress
              ? `Carregando… ${progress.done}/${progress.total}`
              : 'Gerar relatório'}
          </button>
          {entries.length > 0 ? (
            <button
              type="button"
              className={styles.btnImprimir}
              onClick={() => {
                const qs = new URLSearchParams({ mes: String(mes), ano: String(ano), escopo })
                if (escopo === 'lotacao' && lotacaoId) qs.set('lotacao_id', String(lotacaoId))
                if (escopo === 'funcionario' && funcId) qs.set('func_id', String(funcId))
                window.open(`/relatorios/espelho/print?${qs.toString()}`, '_blank')
              }}
            >
              Imprimir / PDF
            </button>
          ) : null}
        </div>

        {progress !== null ? (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* ── Conteúdo do relatório (tela) ──────────────────────────── */}
      {entries.length > 0 ? (
        <div className={styles.report}>
          {entries.map(({ funcionario, espelho }) => (
            <EspelhoBlock
              key={funcionario.id}
              funcionario={funcionario}
              espelho={espelho}
              periodo={periodo}
            />
          ))}
        </div>
      ) : null}

      {/* ── Versão impressão (Portaria MTPS 3626/91) ──────────────── */}
      {entries.length > 0 ? (
        <div className={styles.printOnly}>
          {entries.map(({ espelho }, idx) => (
            <EspelhoImpressao
              key={espelho.meta.funcionario_id}
              espelho={espelho}
              pageNum={idx + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
