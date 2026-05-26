import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../lib/api'
import { formatHoraLocalPtBr } from '../../lib/parseDataHora'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchMe, type FuncionarioMe } from '../../services/userApi'
import {
  fetchEspelho,
  type DiaEspelho,
  type EspelhoPayload,
  type StatusDia,
} from '../../services/espelhoApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { normalizarBatidasEsperadas } from './dashboardDiaUtils'
import { EspelhoImpressao } from '../relatorios/EspelhoImpressao'
import styles from './EspelhoPontoPage.module.css'

function nowYm() {
  const d = new Date()
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

function formatMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function horaLocal(iso: string): string {
  return formatHoraLocalPtBr(iso)
}

function labelMes(m: number): string {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function batidasLinha(dia: DiaEspelho): string {
  if (!dia.marcacoes.length) return '—'
  return dia.marcacoes
    .map((m) => `${horaLocal(m.data_hora)} · ${m.tipo_label}`)
    .join('   ')
}

function formatSaldoCell(minutos: number | null): string {
  if (minutos === null) return '—'
  const sign = minutos >= 0 ? '+' : '−'
  return `${sign}${formatMinutos(Math.abs(minutos))}`
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

const STATUS_CLASS: Partial<Record<StatusDia, string>> = {
  presente: styles.statusPresente,
  falta: styles.statusFalta,
  folga: styles.statusFolga,
  feriado: styles.statusFeriado,
  sem_escala: styles.statusSemEscala,
  ocorrencia: styles.statusOcorrencia,
  atestado: styles.statusOcorrencia,
  abono: styles.statusOcorrencia,
  falta_justificada: styles.statusOcorrencia,
  licenca: styles.statusOcorrencia,
  outros: styles.statusOcorrencia,
}

function obsForRow(dia: DiaEspelho, batidasTurno: number | null | undefined): string {
  if (dia.ocorrencia?.tipo_ocorrencia_descricao) return dia.ocorrencia.tipo_ocorrencia_descricao
  if (dia.ocorrencia?.descricao) return dia.ocorrencia.descricao
  if (dia.feriado) return dia.feriado.descricao
  if (dia.incompleto && dia.marcacoes.length) {
    const n = dia.marcacoes.length
    if (n % 2 === 1) return 'Batidas ímpares (intervalo aberto)'
    if (dia.minutos_previstos != null && batidasTurno != null) {
      const b = normalizarBatidasEsperadas(batidasTurno)
      if (n % b !== 0) return `Ciclo de ${b} batidas incompleto (${n}/${b})`
    }
    return 'Pendência nas batidas'
  }
  return ''
}

function previstoCell(dia: DiaEspelho): string {
  if (dia.feriado) return 'Feriado'
  if (dia.minutos_previstos != null) return formatMinutos(dia.minutos_previstos)
  return '—'
}

export function EspelhoPontoPage() {
  const initial = useMemo(() => nowYm(), [])
  const [ano, setAno] = useState(initial.ano)
  const [mes, setMes] = useState(initial.mes)
  const [data, setData] = useState<EspelhoPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [me, setMe] = useState<FuncionarioMe | null>(null)
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])
  const [selectedFuncId, setSelectedFuncId] = useState<number | null>(null)
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [selectedLotacaoId, setSelectedLotacaoId] = useState<number | null>(null)

  const podeVerOutros = me?.role === 'admin' || me?.role === 'gestor'

  const funcionariosFiltrados = useMemo(() => {
    if (!selectedLotacaoId) return funcionarios
    return funcionarios.filter((f) => f.lotacao_id === selectedLotacaoId)
  }, [funcionarios, selectedLotacaoId])

  const anos = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, i) => y - 3 + i)
  }, [])

  const meses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: labelMes(i + 1),
      })),
    [],
  )

  // Load current user and, if admin/gestor, the employee list and lotações
  useEffect(() => {
    fetchMe()
      .then((m) => {
        setMe(m)
        if (m.role === 'admin' || m.role === 'gestor') {
          return Promise.all([
            fetchFuncionarios({ limit: 500, ativo: 1 }),
            fetchLotacoes(),
          ])
        }
      })
      .then((res) => {
        if (res) {
          setFuncionarios(res[0].data)
          setLotacoes(res[1])
        }
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const funcId = selectedFuncId ?? undefined
      const payload = await fetchEspelho(ano, mes, funcId)
      setData(payload)
    } catch (e) {
      setData(null)
      setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o espelho.')
    } finally {
      setLoading(false)
    }
  }, [ano, mes, selectedFuncId])

  useEffect(() => {
    void load()
  }, [load])

  const nomePeriodo = data?.meta.funcionario_nome
    ? `${data.meta.funcionario_nome} — ${labelMes(mes)} de ${ano}`
    : `${labelMes(mes)} de ${ano}`

  const rowClass = (dia: DiaEspelho) => {
    if (dia.status === 'falta') return styles.rowFalta
    if (dia.status === 'feriado') return styles.rowFeriado
    if (dia.status === 'folga') return styles.rowFolga
    if (['atestado', 'abono', 'falta_justificada', 'licenca', 'outros'].includes(dia.status)) {
      return styles.rowOcorrencia
    }
    if (dia.incompleto && dia.marcacoes.length) return styles.rowWarn
    return undefined
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.printBanner} aria-hidden="true">
        <p className={styles.printBrand}>Sirrus Ponto</p>
        <p className={styles.printTitle}>Espelho de ponto — {nomePeriodo}</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Espelho de Ponto</h1>
          <p className={styles.subtitle}>{nomePeriodo}</p>
        </div>
        <div className={styles.controls}>
          {podeVerOutros && funcionarios.length > 0 && (
            <>
              {lotacoes.length > 0 && (
                <div className={styles.field}>
                  <label htmlFor="espelho-lotacao">Lotação</label>
                  <select
                    id="espelho-lotacao"
                    value={selectedLotacaoId ?? ''}
                    onChange={(e) => {
                      setSelectedLotacaoId(e.target.value === '' ? null : Number(e.target.value))
                      setSelectedFuncId(null)
                    }}
                  >
                    <option value="">Todas</option>
                    {lotacoes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="espelho-func">Funcionário</label>
                <select
                  id="espelho-func"
                  value={selectedFuncId ?? ''}
                  onChange={(e) =>
                    setSelectedFuncId(e.target.value === '' ? null : Number(e.target.value))
                  }
                >
                  <option value="">Meu espelho</option>
                  {funcionariosFiltrados.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className={styles.field}>
            <label htmlFor="espelho-mes">Mês</label>
            <select
              id="espelho-mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {meses.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="espelho-ano">Ano</label>
            <select id="espelho-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={styles.printBtn} onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.feedback} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.loading}>Carregando espelho…</p>
      ) : data ? (
        <>
          <div className={styles.summary}>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Turno</p>
              <p className={styles.sumValue}>{data.meta.turno_nome ?? '—'}</p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Previsto (dia)</p>
              <p className={styles.sumValue}>
                {data.meta.minutos_previsto_dia_referencia != null
                  ? formatMinutos(data.meta.minutos_previsto_dia_referencia)
                  : '—'}
              </p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Trabalhadas no mês</p>
              <p className={styles.sumValue}>{formatMinutos(data.resumo.minutos_trabalhados_mes)}</p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Saldo no mês</p>
              <p className={`${styles.sumValue} ${styles.sumMono}`}>
                {formatSaldoCell(data.resumo.saldo_mes_minutos)}
              </p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Dias presentes</p>
              <p className={`${styles.sumValue} ${styles.sumPresente}`}>{data.resumo.dias_presentes}</p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Faltas</p>
              <p className={`${styles.sumValue} ${data.resumo.dias_falta ? styles.sumFalta : ''}`}>
                {data.resumo.dias_falta}
              </p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Ocorrências</p>
              <p className={`${styles.sumValue} ${data.resumo.dias_ocorrencia ? styles.sumOcorrencia : ''}`}>
                {data.resumo.dias_ocorrencia}
              </p>
            </div>
            <div className={styles.sumCard}>
              <p className={styles.sumLabel}>Dias incompletos</p>
              <p className={`${styles.sumValue} ${data.resumo.dias_incompletos ? styles.sumWarn : ''}`}>
                {data.resumo.dias_incompletos}
              </p>
            </div>
            {data.resumo.total_extras_100pct_minutos > 0 && (
              <div className={styles.sumCard}>
                <p className={styles.sumLabel}>Extras 100%</p>
                <p className={`${styles.sumValue} ${styles.sumMono}`}>
                  +{formatMinutos(data.resumo.total_extras_100pct_minutos)}
                </p>
              </div>
            )}
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
                  <th>Saldo dia</th>
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {data.dias.map((dia) => (
                  <tr key={dia.data} className={rowClass(dia)}>
                    <td className={styles.colDia}>
                      {dia.dia_semana_label} {dia.data.slice(8, 10)}/{dia.data.slice(5, 7)}
                    </td>
                    <td className={styles.colStatus}>
                      <span
                        className={[
                          styles.statusBadge,
                          STATUS_CLASS[dia.status] ?? '',
                        ].join(' ')}
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
                              <span className={styles.badge}>{m.tipo_label}</span>
                              {horaLocal(m.data_hora)}
                            </span>
                          ))}
                    </td>
                    <td className={styles.colTempo}>
                      {dia.marcacoes.length ? formatMinutos(dia.minutos_trabalhados) : '—'}
                    </td>
                    <td className={styles.colTempo}>{previstoCell(dia)}</td>
                    <td className={`${styles.colTempo} ${styles.colSaldo}`}>
                      {formatSaldoCell(dia.saldo_minutos)}
                    </td>
                    <td className={styles.colObs}>{obsForRow(dia, data.meta.batidas_esperadas_dia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
            {data.dias.map((dia) => (
              <article
                key={dia.data}
                className={[
                  styles.cardDay,
                  rowClass(dia) === styles.rowFeriado ? styles.cardDayFeriado : '',
                  rowClass(dia) === styles.rowFalta ? styles.cardDayFalta : '',
                  rowClass(dia) === styles.rowWarn ? styles.cardDayWarn : '',
                  rowClass(dia) === styles.rowOcorrencia ? styles.cardDayOcorrencia : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles.cardDayHead}>
                  <span className={styles.cardDayTitle}>
                    {dia.dia_semana_label} {dia.data.slice(8, 10)}/{dia.data.slice(5, 7)}
                    <span
                      className={[
                        styles.statusBadge,
                        styles.statusBadgeSm,
                        STATUS_CLASS[dia.status] ?? '',
                      ].join(' ')}
                    >
                      {STATUS_LABEL[dia.status] ?? dia.status}
                    </span>
                  </span>
                  <span className={styles.cardDaySub}>
                    {dia.marcacoes.length ? formatMinutos(dia.minutos_trabalhados) : '—'}
                  </span>
                </div>
                {dia.ocorrencia?.descricao ? (
                  <p className={styles.cardOcorrenciaTxt}>{dia.ocorrencia.descricao}</p>
                ) : dia.feriado ? (
                  <p className={styles.cardFeriadoTxt}>{dia.feriado.descricao}</p>
                ) : null}
                <div className={styles.cardDayBat}>{batidasLinha(dia)}</div>
                <div className={styles.cardMeta}>
                  <span>Prev.: {previstoCell(dia)}</span>
                  <span>Saldo: {formatSaldoCell(dia.saldo_minutos)}</span>
                </div>
                <div className={styles.cardDayFoot}>{obsForRow(dia, data.meta.batidas_esperadas_dia)}</div>
              </article>
            ))}
          </div>

          {/* Versão impressão — oculta na tela, visível no print */}
          {data ? <EspelhoImpressao espelho={data} pageNum={1} /> : null}

          <p className={styles.legend}>
            Horários no fuso do navegador.
            {data.meta.batidas_esperadas_dia != null ? (
              <>
                {' '}
                O turno prevê{' '}
                <strong>{normalizarBatidasEsperadas(data.meta.batidas_esperadas_dia)} batidas</strong>{' '}
                por dia útil; os minutos trabalhados são a soma dos intervalos em pares (1ª–2ª, 3ª–4ª, …).
              </>
            ) : (
              <> Sem turno vinculado: não há exigência de ciclo de batidas.</>
            )}{' '}
            {data.meta.usa_escala
              ? 'Funcionário com escala: dias de trabalho e folga definidos pela escala cadastrada.'
              : 'Funcionário sem escala: Dom = folga; Seg–Sáb = dia de trabalho.'}{' '}
            PDF: use <strong>Imprimir / PDF</strong> e escolha "Salvar como PDF" no navegador.
          </p>
        </>
      ) : null}
    </div>
  )
}
