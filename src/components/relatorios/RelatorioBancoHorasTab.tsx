import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchFiliais, type Filial } from '../../services/filiaisApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { fetchRelatorioBancoHoras, type SaldoEmpresaBancoHoras } from '../../services/bancoHorasApi'
import { RelatorioPrintLayout } from './RelatorioPrintLayout'
import styles from './RelatoriosPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minToHHMM(min: number): string {
  const sinal = min < 0 ? '-' : ''
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function labelMesReferencia(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RelatorioBancoHorasTab() {
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [filialId, setFilialId] = useState<number | ''>('')
  const [lotacaoId, setLotacaoId] = useState<number | ''>('')
  const [mesReferencia, setMesReferencia] = useState('') // "" = saldo atual real (todo o histórico)

  const [rows, setRows] = useState<SaldoEmpresaBancoHoras[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFiliais().then(setFiliais).catch(() => {})
    fetchLotacoes().then(setLotacoes).catch(() => {})
  }, [])

  const printCompanyName = useMemo(() => {
    if (filialId !== '') return filiais.find((f) => f.id === filialId)?.nome ?? 'Empresa'
    return filiais.length === 1 ? filiais[0].nome : 'Empresa'
  }, [filialId, filiais])

  const gerar = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchRelatorioBancoHoras({
        filialId: filialId || undefined,
        lotacaoId: lotacaoId || undefined,
        mesReferencia: mesReferencia || undefined,
      })
      setRows(data)
    } catch {
      setError('Erro ao gerar o relatório.')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [filialId, lotacaoId, mesReferencia])

  const totais = useMemo(() => {
    if (!rows) return null
    return rows.reduce(
      (acc, r) => ({
        saldo_50pct_minutos: acc.saldo_50pct_minutos + r.saldo_50pct_minutos,
        saldo_100pct_minutos: acc.saldo_100pct_minutos + r.saldo_100pct_minutos,
      }),
      { saldo_50pct_minutos: 0, saldo_100pct_minutos: 0 },
    )
  }, [rows])

  const reportTitle = mesReferencia
    ? `Banco de Horas — Saldo até ${labelMesReferencia(mesReferencia)}`
    : 'Banco de Horas — Saldo Atual'

  return (
    <>
      {/* ── Screen ────────────────────────────────────────────────── */}
      <div className={styles.screenSection}>
        <div className={styles.filterBar}>
          <div className={styles.field}>
            <label>Filial</label>
            <select value={filialId} onChange={(e) => setFilialId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Lotação</label>
            <select value={lotacaoId} onChange={(e) => setLotacaoId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Todas</option>
              {lotacoes.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Saldo até (opcional)</label>
            <input type="month" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} />
          </div>
          <button type="button" className={styles.btnGerar} onClick={() => void gerar()} disabled={loading}>
            {loading ? 'Gerando…' : 'Gerar'}
          </button>
          {rows && rows.length > 0 ? (
            <button type="button" className={styles.btnImprimir} onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          ) : null}
        </div>

        {error ? <p className={styles.errorMsg}>{error}</p> : null}

        {rows !== null ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>Filial</th>
                  <th>Lotação</th>
                  <th>Saldo 50%</th>
                  <th>Saldo 100%</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className={styles.tableEmpty}>Nenhum funcionário com banco de horas para o filtro selecionado.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.funcionario_id}>
                    <td>{r.matricula ?? '—'}</td>
                    <td>{r.funcionario_nome}</td>
                    <td>{r.filial_nome ?? '—'}</td>
                    <td>{r.lotacao_nome ?? '—'}</td>
                    <td>{minToHHMM(r.saldo_50pct_minutos)}</td>
                    <td>{minToHHMM(r.saldo_100pct_minutos)}</td>
                  </tr>
                ))}
              </tbody>
              {totais && rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={4}><strong>Total</strong></td>
                    <td><strong>{minToHHMM(totais.saldo_50pct_minutos)}</strong></td>
                    <td><strong>{minToHHMM(totais.saldo_100pct_minutos)}</strong></td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Print ─────────────────────────────────────────────────── */}
      {rows && rows.length > 0 ? (
        <div className={styles.printSection}>
          <RelatorioPrintLayout
            reportNum={5}
            reportTitle={reportTitle}
            companyName={printCompanyName}
            pageNum={1}
          >
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>Filial</th>
                  <th>Lotação</th>
                  <th>Saldo 50%</th>
                  <th>Saldo 100%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.funcionario_id}>
                    <td>{r.matricula ?? ''}</td>
                    <td>{r.funcionario_nome}</td>
                    <td>{r.filial_nome ?? ''}</td>
                    <td>{r.lotacao_nome ?? ''}</td>
                    <td>{minToHHMM(r.saldo_50pct_minutos)}</td>
                    <td>{minToHHMM(r.saldo_100pct_minutos)}</td>
                  </tr>
                ))}
              </tbody>
              {totais ? (
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total</td>
                    <td>{minToHHMM(totais.saldo_50pct_minutos)}</td>
                    <td>{minToHHMM(totais.saldo_100pct_minutos)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </RelatorioPrintLayout>
        </div>
      ) : null}
    </>
  )
}
