import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchOcorrencias, type Ocorrencia } from '../../services/ocorrenciasApi'
import { RelatorioPrintLayout } from './RelatorioPrintLayout'
import styles from './RelatoriosPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelMes(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function fmtDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

type FilialOption = { id: number; nome: string }

// ─── Component ────────────────────────────────────────────────────────────────

export function RelatorioOcorrenciasTab() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [filialId, setFilialId] = useState<number | ''>('')
  const [todos, setTodos] = useState<FuncionarioListItem[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    fetchFuncionarios({ limit: 1000, ativo: 1 })
      .then((r) => setTodos(r.data))
      .catch(() => {})
  }, [])

  const filiais = useMemo<FilialOption[]>(() => {
    const seen = new Map<number, string>()
    for (const f of todos) {
      if (f.filial_id != null && f.filial_nome) seen.set(f.filial_id, f.filial_nome)
    }
    return Array.from(seen.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [todos])

  const printCompanyName = useMemo(() => {
    if (filialId !== '') return filiais.find((f) => f.id === filialId)?.nome ?? 'Empresa'
    return filiais.length === 1 ? filiais[0].nome : 'Empresa'
  }, [filialId, filiais])

  const anos = useMemo(() => {
    const y = now.getFullYear()
    return Array.from({ length: 5 }, (_, i) => y - 2 + i)
  }, [])

  const meses = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: labelMes(i + 1) })),
    [],
  )

  const gerar = useCallback(async () => {
    setError(null)
    setOcorrencias(null)
    setLoading(true)
    abortRef.current = false
    try {
      const data = await fetchOcorrencias({ ano, mes })
      setOcorrencias(data)
    } catch {
      setError('Erro ao carregar ocorrências.')
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  // Filter by filial locally using the funcionários list
  const funcFilialSet = useMemo(() => {
    if (filialId === '') return null
    return new Set(todos.filter((f) => f.filial_id === (filialId as number)).map((f) => f.id))
  }, [todos, filialId])

  const filtered = useMemo(() => {
    if (!ocorrencias) return null
    if (!funcFilialSet) return ocorrencias
    return ocorrencias.filter((o) => funcFilialSet.has(o.funcionario_id))
  }, [ocorrencias, funcFilialSet])

  function periodoStr(o: Ocorrencia): string {
    if (o.data_inicio === o.data_fim) return fmtDate(o.data_inicio)
    return `${fmtDate(o.data_inicio)} a ${fmtDate(o.data_fim)}`
  }

  function tipoLabel(o: Ocorrencia): string {
    if (o.tipo_ocorrencia_descricao) return o.tipo_ocorrencia_descricao
    return o.tipo
  }

  return (
    <>
      {/* ── Screen ────────────────────────────────────────────────── */}
      <div className={styles.screenSection}>
        <div className={styles.filterBar}>
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
          <div className={styles.field}>
            <label>Filial</label>
            <select value={filialId} onChange={(e) => setFilialId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={styles.btnGerar}
            onClick={() => void gerar()}
            disabled={loading}
          >
            {loading ? 'Carregando…' : 'Gerar'}
          </button>
          {filtered && filtered.length > 0 ? (
            <button type="button" className={styles.btnImprimir} onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          ) : null}
        </div>

        {error ? <p className={styles.errorMsg}>{error}</p> : null}

        {filtered !== null ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th>Lançamento</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className={styles.tableEmpty}>Nenhuma ocorrência encontrada no período.</td></tr>
                ) : filtered.map((o) => (
                  <tr key={o.id}>
                    <td>{o.funcionario_nome}</td>
                    <td>{tipoLabel(o)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{periodoStr(o)}</td>
                    <td>{o.tipo_lancamento === 'credito' ? 'Crédito' : o.tipo_lancamento === 'debito' ? 'Débito' : '—'}</td>
                    <td>{o.descricao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Print ─────────────────────────────────────────────────── */}
      {filtered && filtered.length > 0 ? (
        <div className={styles.printSection}>
          <RelatorioPrintLayout
            reportNum={4}
            reportTitle={`Ocorrências — ${labelMes(mes)} de ${ano}`}
            companyName={printCompanyName}
            pageNum={1}
          >
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th>Lançamento</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>{o.funcionario_nome}</td>
                    <td>{tipoLabel(o)}</td>
                    <td>{periodoStr(o)}</td>
                    <td>{o.tipo_lancamento === 'credito' ? 'Crédito' : o.tipo_lancamento === 'debito' ? 'Débito' : ''}</td>
                    <td>{o.descricao ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RelatorioPrintLayout>
        </div>
      ) : null}
    </>
  )
}
