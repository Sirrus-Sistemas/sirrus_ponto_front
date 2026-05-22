import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { RelatorioPrintLayout } from './RelatorioPrintLayout'
import styles from './RelatoriosPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCpf(cpf: string | null): string {
  if (!cpf) return ''
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return cpf
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  // YYYY-MM-DD → DD/MM/YYYY
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

type FilialOption = { id: number; nome: string }

// ─── Component ────────────────────────────────────────────────────────────────

export function RelatorioFuncionariosTab() {
  const [todos, setTodos] = useState<FuncionarioListItem[]>([])
  const [filialId, setFilialId] = useState<number | ''>('')
  const [ativo, setAtivo] = useState<1 | 0>(1)
  const [lista, setLista] = useState<FuncionarioListItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  // Load all employees once to build filial dropdown
  useEffect(() => {
    fetchFuncionarios({ limit: 1000, ativo: 1 })
      .then((r) => setTodos(r.data))
      .catch(() => {})
    fetchFuncionarios({ limit: 1000, ativo: 0 })
      .then((r) => setTodos((prev) => {
        const ids = new Set(prev.map((f) => f.id))
        return [...prev, ...r.data.filter((f) => !ids.has(f.id))]
      }))
      .catch(() => {})
  }, [])

  const filiais = useMemo<FilialOption[]>(() => {
    const seen = new Map<number, string>()
    for (const f of todos) {
      if (f.filial_id != null && f.filial_nome) {
        seen.set(f.filial_id, f.filial_nome)
      }
    }
    return Array.from(seen.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [todos])

  const printCompanyName = useMemo(() => {
    if (filialId !== '') return filiais.find((f) => f.id === filialId)?.nome ?? 'Empresa'
    return filiais.length === 1 ? filiais[0].nome : 'Empresa'
  }, [filialId, filiais])

  async function gerar() {
    setError(null)
    setLoading(true)
    abortRef.current = false
    try {
      const params: Parameters<typeof fetchFuncionarios>[0] = {
        limit: 1000,
        ativo,
      }
      if (filialId !== '') params.filial_id = filialId as number
      const r = await fetchFuncionarios(params)
      setLista(r.data)
    } catch {
      setError('Erro ao carregar funcionários.')
    } finally {
      setLoading(false)
    }
  }

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
            <label>Status</label>
            <select value={ativo} onChange={(e) => setAtivo(Number(e.target.value) as 1 | 0)}>
              <option value={1}>Ativos</option>
              <option value={0}>Inativos</option>
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
          {lista && lista.length > 0 ? (
            <button type="button" className={styles.btnImprimir} onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          ) : null}
        </div>

        {error ? <p className={styles.errorMsg}>{error}</p> : null}

        {lista !== null ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Filial</th>
                  <th>Cargo</th>
                  <th>Turno</th>
                  <th>Admissão</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr><td colSpan={7} className={styles.tableEmpty}>Nenhum funcionário encontrado.</td></tr>
                ) : lista.map((f) => (
                  <tr key={f.id}>
                    <td>{f.matricula ?? '—'}</td>
                    <td>{f.nome}</td>
                    <td>{fmtCpf(f.cpf)}</td>
                    <td>{f.filial_nome ?? '—'}</td>
                    <td>{f.cargo ?? '—'}</td>
                    <td>{f.turno_nome ?? '—'}</td>
                    <td>{fmtDate(f.data_admissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Print ─────────────────────────────────────────────────── */}
      {lista && lista.length > 0 ? (
        <div className={styles.printSection}>
          <RelatorioPrintLayout
            reportNum={1}
            reportTitle="Funcionários Cadastrados"
            companyName={printCompanyName}
            pageNum={1}
          >
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Filial</th>
                  <th>Cargo</th>
                  <th>Admissão</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id}>
                    <td>{f.matricula ?? ''}</td>
                    <td>{f.nome}</td>
                    <td>{fmtCpf(f.cpf)}</td>
                    <td>{f.filial_nome ?? ''}</td>
                    <td>{f.cargo ?? ''}</td>
                    <td>{fmtDate(f.data_admissao)}</td>
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
