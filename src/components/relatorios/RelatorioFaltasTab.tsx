import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchEspelho } from '../../services/espelhoApi'
import { RelatorioPrintLayout } from './RelatorioPrintLayout'
import styles from './RelatoriosPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function labelMes(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function fmtCpf(cpf: string | null): string {
  if (!cpf) return ''
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return cpf
}

function fmtDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

type FilialOption = { id: number; nome: string }

type FaltaRow = {
  funcionario: FuncionarioListItem
  data: string
  diaSemana: string
  status: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RelatorioFaltasTab() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [filialId, setFilialId] = useState<number | ''>('')
  const [todos, setTodos] = useState<FuncionarioListItem[]>([])
  const [rows, setRows] = useState<FaltaRow[] | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
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
    setRows(null)
    abortRef.current = false

    const lista = filialId !== ''
      ? todos.filter((f) => f.filial_id === filialId)
      : todos

    if (!lista.length) {
      setError('Nenhum funcionário encontrado.')
      return
    }

    setProgress({ done: 0, total: lista.length })
    const result: FaltaRow[] = []

    for (const func of lista) {
      if (abortRef.current) break
      try {
        const espelho = await fetchEspelho(ano, mes, func.id)
        for (const dia of espelho.dias) {
          if (dia.status === 'falta') {
            result.push({
              funcionario: func,
              data: dia.data,
              diaSemana: dia.dia_semana_label,
              status: 'Falta',
            })
          }
        }
      } catch {
        // skip on error
      }
      setProgress((p) => p ? { done: p.done + 1, total: p.total } : null)
    }

    setProgress(null)
    setRows(result)
  }, [todos, filialId, ano, mes])

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0

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
            disabled={progress !== null}
          >
            {progress ? `Carregando… ${progress.done}/${progress.total}` : 'Gerar'}
          </button>
          {rows && rows.length > 0 ? (
            <button type="button" className={styles.btnImprimir} onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          ) : null}
        </div>

        {progress !== null ? (
          <div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <p className={styles.progressLabel}>{progress.done} de {progress.total} funcionários processados</p>
          </div>
        ) : null}

        {error ? <p className={styles.errorMsg}>{error}</p> : null}

        {rows !== null ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Data</th>
                  <th>Dia da Semana</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className={styles.tableEmpty}>Nenhuma falta encontrada no período.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.funcionario.id}-${r.data}-${i}`}>
                    <td>{r.funcionario.matricula ?? '—'}</td>
                    <td>{r.funcionario.nome}</td>
                    <td>{fmtCpf(r.funcionario.cpf)}</td>
                    <td>{fmtDate(r.data)}</td>
                    <td>{r.diaSemana}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Print ─────────────────────────────────────────────────── */}
      {rows && rows.length > 0 ? (
        <div className={styles.printSection}>
          <RelatorioPrintLayout
            reportNum={2}
            reportTitle={`Faltas — ${labelMes(mes)} de ${ano}`}
            companyName={printCompanyName}
            pageNum={1}
          >
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Data</th>
                  <th>Dia</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.funcionario.id}-${r.data}-${i}`}>
                    <td>{r.funcionario.matricula ?? ''}</td>
                    <td>{r.funcionario.nome}</td>
                    <td>{fmtCpf(r.funcionario.cpf)}</td>
                    <td>{fmtDate(r.data)}</td>
                    <td>{r.diaSemana}</td>
                    <td>{r.status}</td>
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
