import { formatHoraLocalPtBr } from '../../lib/parseDataHora'
import type { EspelhoPayload, MarcacaoEspelho } from '../../services/espelhoApi'
import styles from './EspelhoImpressao.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function minToHHMM(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return `${String(h).padStart(2, '0')}:${pad2(m)}`
}

function formatDataPrint(iso: string): string {
  // "YYYY-MM-DD" → "DD/MM/AA"
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
}

function horaMin(m: MarcacaoEspelho): string {
  const iso = m.data_hora_local ?? m.data_hora
  return formatHoraLocalPtBr(iso)
}

function fmtCpf(cpf: string | null): string {
  if (!cpf) return ''
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return cpf
}

// ─── Per-day row logic ────────────────────────────────────────────────────────

const NUM_SLOTS = 8 // Ent1 Sai1 Ent2 Sai2 Ent3 Sai3 Ent4 Sai4

/** Aplica slot_override: posiciona batidas fixas e preenche lacunas em ordem cronológica. */
function applySlotOverride(sorted: MarcacaoEspelho[]): (MarcacaoEspelho | null)[] {
  const slots: (MarcacaoEspelho | null)[] = new Array(NUM_SLOTS).fill(null)
  const hasOverride = sorted.some(m => m.slot_override !== null && m.slot_override !== undefined)

  if (!hasOverride) {
    // Sem override: preenche sequencialmente
    sorted.forEach((m, i) => { if (i < NUM_SLOTS) slots[i] = m })
    return slots
  }

  const overridden = sorted
    .filter(m => m.slot_override !== null && m.slot_override !== undefined)
    .sort((a, b) => (a.slot_override ?? 0) - (b.slot_override ?? 0))
  const normal = sorted.filter(m => m.slot_override === null || m.slot_override === undefined)

  for (const m of overridden) {
    const pos = m.slot_override!
    if (pos < NUM_SLOTS && slots[pos] === null) slots[pos] = m
  }
  let ni = 0
  for (let i = 0; i < NUM_SLOTS && ni < normal.length; i++) {
    if (slots[i] === null) slots[i] = normal[ni++]
  }
  return slots
}

function buildSlots(marcacoes: MarcacaoEspelho[]) {
  // Helper para deduplica por HH:MM — mesma lógica que useFichaDePonto.ts
  function deduplicateByHHMM(items: MarcacaoEspelho[]): MarcacaoEspelho[] {
    const seenTimes = new Set<string>()
    return items.filter(m => {
      const d = new Date(m.data_hora)
      const key = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      if (seenTimes.has(key)) return false
      seenTimes.add(key)
      return true
    })
  }

  // REP-only punches — coluna "Marcações REP" sempre em ordem cronológica (batidas originais)
  const repPunchesSorted = marcacoes
    .filter((m) => m.tipo === 'rep')
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  // Deduplica REP por HH:MM para consistência com a tela
  const repPunches = deduplicateByHHMM(repPunchesSorted)

  // All treated punches — coluna "Tratamento Efetuado" respeita slot_override
  const allSorted = [...marcacoes].sort(
    (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
  )

  // Deduplica todas as batidas por HH:MM para consistência com a tela
  const allDeduped = deduplicateByHHMM(allSorted)

  const repSlots: (MarcacaoEspelho | null)[] = Array.from({ length: NUM_SLOTS }, (_, i) => repPunches[i] ?? null)
  const allSlots = applySlotOverride(allDeduped)

  const motivoParts: string[] = allDeduped
    .filter((all) => all.tipo !== 'rep')
    .map((all) => (all.tipo === 'manual' && all.motivo_edicao) ? all.motivo_edicao : all.tipo_label)

  const motivoStr = motivoParts.join(' / ')

  return { repSlots, allSlots, motivoStr }
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  espelho: EspelhoPayload
  pageNum?: number
  inline?: boolean
}

export function EspelhoImpressao({ espelho, pageNum = 1, inline = false }: Props) {
  const { meta, resumo, dias } = espelho

  const now = new Date()
  const emissao = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`

  const periodoInicio = dias[0]?.data ? formatDataPrint(dias[0].data) : ''
  const periodoFim = dias[dias.length - 1]?.data ? formatDataPrint(dias[dias.length - 1].data) : ''

  // Footer — usa exclusivamente os valores calculados pelo backend (resumo)
  const totalCargaMin = dias
    .filter((d) => d.minutos_previstos != null)
    .reduce((s, d) => s + d.minutos_previstos!, 0)

  const saldoMin       = resumo.saldo_mes_minutos ?? 0
  const totalDebitoMin = saldoMin < 0 ? Math.abs(saldoMin) : 0

  const totalExtras100pctMin = resumo.total_extras_100pct_minutos ?? 0
  const totalExtras50pctMin  = resumo.total_extras_50pct_minutos ?? 0
  const totalNoturnoMin      = resumo.total_minutos_noturno ?? 0
  // CLT art. 73 §1: 52min30s = 1h noturna → acréscimo = round(noturno / 7)
  const totalAcrescimoMin       = Math.round(totalNoturnoMin / 7)
  const totalHorasEmAdicionalMin = totalNoturnoMin + totalAcrescimoMin

  const empresaEndereco = [meta.empresa_endereco, meta.empresa_cidade, meta.empresa_uf]
    .filter(Boolean)
    .join(' / ')

  const turnoLabel = [meta.turno_nome, meta.turno_horario].filter(Boolean).join(' ')

  return (
    <div className={inline ? styles.blockInline : styles.block}>
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.phRow1}>
          <span className={styles.phBrand}>Sirrus.Ponto - Sistema Gerenciador &amp; Ponto Eletrônico</span>
          <span className={styles.phEmissao}>Emissão:&nbsp;&nbsp;{emissao}</span>
        </div>
        <div className={styles.phRow2}>
          <span>Relatório de Espelho do Ponto Eletrônico</span>
          <span>Empresa Registro: {meta.empresa_razao_social ?? '—'}</span>
          <span>Página:&nbsp;&nbsp;{String(pageNum).padStart(4, '0')}</span>
        </div>
        <table className={styles.phTable}>
          <tbody>
            <tr>
              <td className={styles.phLeft}>
                Funcionário:&nbsp;{meta.funcionario_matricula ?? ''}&nbsp;&nbsp;
                {meta.funcionario_nome ?? ''}&nbsp;&nbsp;
                PIS:&nbsp;{meta.funcionario_pis ?? ''}&nbsp;&nbsp;
                Matrícula:&nbsp;{meta.funcionario_matricula ?? ''}&nbsp;&nbsp;
                Cód. Siape:
              </td>
              <td className={styles.phRight}>{meta.empresa_cnpj ?? ''}</td>
            </tr>
            <tr>
              <td className={styles.phLeft}>
                Função:&nbsp;{meta.funcionario_cargo ?? ''}&nbsp;&nbsp;
                Período:&nbsp;{periodoInicio}&nbsp;A&nbsp;{periodoFim}&nbsp;&nbsp;
                Admissão:&nbsp;
                {meta.funcionario_data_admissao
                  ? formatDataPrint(meta.funcionario_data_admissao)
                  : ''}
              </td>
              <td className={styles.phRight}>
                {meta.empresa_razao_social ?? ''}{empresaEndereco ? ` / ${empresaEndereco}` : ''}
              </td>
            </tr>
          </tbody>
        </table>
        <div className={styles.phTurno}>T.Horário:&nbsp;{turnoLabel || '—'}</div>
      </div>

      {/* ── Tabela principal ──────────────────────────────────────── */}
      <table className={styles.table}>
        <colgroup>
          <col className={styles.cData} />
          <col className={styles.cDia} />
          {/* REP × 8 */}
          <col className={styles.cTime} /><col className={styles.cTime} />
          <col className={styles.cTime} /><col className={styles.cTime} />
          <col className={styles.cTime} /><col className={styles.cTime} />
          <col className={styles.cTime} /><col className={styles.cTime} />
          {/* Jornada × 8 */}
          <col className={styles.cTime} /><col className={styles.cTime} />
          <col className={styles.cTime} /><col className={styles.cTime} />
          <col className={styles.cTime} /><col className={styles.cTime} />
          <col className={styles.cTime} /><col className={styles.cTime} />
          {/* CH / Horário / Ocor */}
          <col className={styles.cCh} />
          <col className={styles.cHorario} />
          <col className={styles.cOcor} />
          {/* Motivo */}
          <col className={styles.cMotivo} />
          {/* Right cols */}
          <col className={styles.cTotal} />
          <col className={styles.cTotal} />
          <col className={styles.cTotal} />
          <col className={styles.cTotal} />
          <col className={styles.cAdn} />
          <col className={styles.cNoc} />
          <col className={styles.cTotal} />
        </colgroup>
        <thead>
          <tr className={styles.thSection}>
            <th colSpan={2}></th>
            <th colSpan={8} className={styles.thSectionLabel}>MARCAÇÕES REP</th>
            <th colSpan={11} className={styles.thSectionLabel}>Jornada Realizada</th>
            <th colSpan={1} className={styles.thSectionLabel}>Tratamento Efetuado Sobre os Dados Originais</th>
            <th colSpan={7}></th>
          </tr>
          <tr className={styles.thCols}>
            <th>Data</th>
            <th>Dia</th>
            <th>Ent 1</th><th>Sai 1</th><th>Ent 2</th><th>Sai 2</th><th>Ent 3</th><th>Sai 3</th><th>Ent 4</th><th>Sai 4</th>
            <th>Ent. 1</th><th>Sai. 1</th><th>Ent. 2</th><th>Sai. 2</th><th>Ent. 3</th><th>Sai. 3</th><th>Ent. 4</th><th>Sai. 4</th>
            <th>CH</th><th>Horário</th><th>Ocor.</th>
            <th>Motivo</th>
            <th>Total</th><th>Extras</th><th>100%</th><th>Débito</th>
            <th>ADN</th><th>N.OC.</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => {
            const isOcorrencia = dia.status === 'ocorrencia'
            const isFeriado = dia.modifiers?.includes('feriado') ?? false
            const isAnomalo = dia.modifiers?.includes('jornada_anomala') ?? false

            const diaLabel =
              isFeriado
                ? 'FERIADO'
                : dia.status === 'folga'
                ? `${dia.dia_semana_label.toUpperCase()} FOLGA`
                : dia.status === 'falta'
                ? `${dia.dia_semana_label.toUpperCase()} FALTA`
                : dia.dia_semana_label.toUpperCase()

            const extras50dia = dia.extras_50pct_minutos ?? 0
            const extras = extras50dia > 0
              ? extras50dia
              : dia.saldo_minutos != null && dia.saldo_minutos > 0 ? dia.saldo_minutos : 0
            const debito = dia.saldo_minutos != null && dia.saldo_minutos < 0 ? Math.abs(dia.saldo_minutos) : 0
            const extras100 = dia.extras_100pct_minutos ?? 0
            const noturno = dia.minutos_noturno ?? 0

            const trClass = [
              styles.trData,
              isFeriado ? styles.trFeriado : '',
              dia.status === 'falta' ? styles.trFalta : '',
              dia.status === 'folga' ? styles.trFolga : '',
              isOcorrencia ? styles.trOcorrencia : '',
              isAnomalo ? styles.trAnomalo : '',
            ]
              .filter(Boolean)
              .join(' ')

            // Collapse only folga/feriado/futuro without punches.
            // Occurrences always render the full row (need to show minutos_previstos in Total).
            if (!isOcorrencia && dia.status !== 'falta' && dia.marcacoes.length === 0) {
              return (
                <tr key={dia.data} className={trClass}>
                  <td>{formatDataPrint(dia.data)}</td>
                  <td colSpan={28} className={styles.tdDiaLabel}>{diaLabel}</td>
                </tr>
              )
            }

            // For occurrence rows without punches, use minutos_previstos as the "total" to display
            const totalExibicao =
              dia.marcacoes.length > 0
                ? dia.minutos_trabalhados
                : isOcorrencia && dia.minutos_previstos != null
                  ? dia.minutos_previstos
                  : null

            const ocorrenciaLabel =
              dia.ocorrencia?.tipo_ocorrencia_descricao ||
              dia.ocorrencia?.descricao ||
              'OCORRÊNCIA'
            const { repSlots, allSlots, motivoStr: motivoMarcacao } = buildSlots(dia.marcacoes)
            const motivoStr = isOcorrencia
              ? [ocorrenciaLabel, motivoMarcacao].filter(Boolean).join(' — ')
              : motivoMarcacao

            return (
              <tr key={dia.data} className={trClass}>
                <td>{formatDataPrint(dia.data)}</td>
                <td className={styles.tdDiaLabel}>{diaLabel}</td>
                {/* REP */}
                {repSlots.map((p, i) => (
                  <td key={`rep${i}`} className={styles.tdTime}>
                    {p ? horaMin(p) : '-'}
                  </td>
                ))}
                {/* Jornada */}
                {allSlots.map((p, i) => (
                  <td key={`jrn${i}`} className={styles.tdTime}>
                    {p ? horaMin(p) : '-'}
                  </td>
                ))}
                <td className={styles.tdCh}>{meta.turno_id ?? '-'}</td>
                <td className={styles.tdTime}>
                  {totalExibicao != null ? minToHHMM(totalExibicao) : '-'}
                </td>
                <td>-</td>
                <td className={styles.tdMotivo} style={isAnomalo ? { backgroundColor: '#ffe6e6' } : {}}>
                  {isAnomalo && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠ REVISAR</span>}
                  {isAnomalo && motivoStr && ' — '}
                  {motivoStr}
                </td>
                {/* Right totals */}
                <td className={styles.tdTime}>
                  {totalExibicao != null ? minToHHMM(totalExibicao) : '00:00'}
                </td>
                <td className={styles.tdTime}>{extras ? minToHHMM(extras) : '00:00'}</td>
                <td className={styles.tdTime}>{extras100 ? minToHHMM(extras100) : '00:00'}</td>
                <td className={styles.tdTime}>{debito ? minToHHMM(debito) : '00:00'}</td>
                <td className={styles.tdTime}>{noturno ? minToHHMM(noturno) : '00:00'}</td>
                <td>0</td>
                <td className={styles.tdTime}>
                  {totalExibicao != null ? minToHHMM(totalExibicao) : '00:00'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Rodapé ────────────────────────────────────────────────── */}
      <table className={styles.footerTable}>
        <tbody>
          <tr className={styles.footerSection}>
            <td colSpan={2} className={styles.footerSectionLabel}>
              Total Dias:&nbsp;<strong>{dias.length}</strong>&nbsp;&nbsp;
              Carga Horária:&nbsp;<strong>{minToHHMM(totalCargaMin)}</strong>
            </td>
            <td className={styles.footerSectionLabel}>Resumo de Ocorrências</td>
            <td className={styles.footerSectionLabel}>Adicional Noturno</td>
            <td className={styles.footerSectionLabel}>Banco de Horas</td>
          </tr>
          <tr>
            <td>Total Faltas:&nbsp;<strong>{resumo.dias_falta}</strong></td>
            <td></td>
            <td className={styles.footerOcor}>DÉBITOS (-)</td>
            <td>Adicional Noturno:&nbsp;{totalNoturnoMin ? minToHHMM(totalNoturnoMin) : '0:00'}</td>
            <td>Saldo Anterior:</td>
          </tr>
          <tr>
            <td>Total 1/2 Faltas:&nbsp;0</td>
            <td>Total Extras:&nbsp;50%:&nbsp;<strong>{minToHHMM(totalExtras50pctMin)}</strong></td>
            <td className={styles.footerOcor}>CRÉDITOS (+)</td>
            <td>Acréscimo:&nbsp;{totalAcrescimoMin ? minToHHMM(totalAcrescimoMin) : '00:00'}</td>
            <td>Horas 50%:&nbsp;{saldoMin >= 0 ? `(+) ${minToHHMM(saldoMin)}` : `(-) ${minToHHMM(Math.abs(saldoMin))}`}</td>
          </tr>
          <tr>
            <td>Total Feriados:&nbsp;<strong>{meta.dias_feriado_calendario}</strong></td>
            <td>Total Débito:&nbsp;50%:&nbsp;<strong>{minToHHMM(totalDebitoMin)}</strong></td>
            <td>Total:&nbsp;0:00</td>
            <td>Horas em Adicional:&nbsp;{totalHorasEmAdicionalMin ? minToHHMM(totalHorasEmAdicionalMin) : '00:00'}</td>
            <td>Horas 100%:&nbsp;{totalExtras100pctMin ? `(+) ${minToHHMM(totalExtras100pctMin)}` : '00:00'}</td>
          </tr>
          <tr>
            <td>Horas Trabalhadas:&nbsp;<strong>{minToHHMM(resumo.minutos_trabalhados_mes)}</strong></td>
            <td>Total Horas:&nbsp;50%:&nbsp;
              {saldoMin >= 0
                ? `(+) ${minToHHMM(saldoMin)}`
                : `(-) ${minToHHMM(Math.abs(saldoMin))}`}
            </td>
            <td>Total:&nbsp;0:00</td>
            <td></td>
            <td>Saldo Atual:</td>
          </tr>
          <tr>
            <td></td>
            <td>Total Extras 100%:&nbsp;{totalExtras100pctMin ? `(+) ${minToHHMM(totalExtras100pctMin)}` : '(+) 00:00'}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {/* ── Aviso de Jornada Anomala ─────────────────────────────── */}
      {dias.some(d => d.modifiers?.includes('jornada_anomala')) && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '4px',
          padding: '12px',
          marginTop: '12px',
          fontSize: '14px',
          color: '#92400e',
          fontWeight: 'bold'
        }}>
          ⚠ ATENÇÃO: Este espelho contém dias com jornada anomala. Revise os dados marcados com "⚠ REVISAR".
        </div>
      )}

      {/* ── Assinaturas ───────────────────────────────────────────── */}
      <div className={styles.signatures}>
        <div className={styles.sigBlock}>
          <div className={styles.sigLine}></div>
          <p>{meta.empresa_razao_social ?? ''}</p>
          <p>CPF:&nbsp;{fmtCpf(meta.funcionario_cpf)}</p>
        </div>
        <div className={styles.sigBlock}>
          <div className={styles.sigLine}></div>
          <p>{meta.funcionario_nome ?? ''}</p>
        </div>
      </div>

      {/* ── Nota legal ────────────────────────────────────────────── */}
      <p className={styles.legal}>
        De conformidade com a Portaria MTPS 3626/91, Art. 13, este relatório substitui, para todos
        os efeitos legais, o quadro de horário de trabalho, inclusive o de menores.
      </p>
    </div>
  )
}
