import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import {
  fetchAuditoria,
  type AuditoriaRegistro,
  type AuditoriaTabela,
  type AuditoriaAcao,
  type AuditoriaPagination,
} from '../../services/auditoriaApi'
import styles from './RelatoriosPage.module.css'

const TABELA_LABELS: Record<AuditoriaTabela, string> = {
  marcacoes: 'Marcações',
  marcacoes_dia_bloqueado: 'Dias bloqueados',
  escalas: 'Escalas',
  ocorrencias: 'Ocorrências',
  funcionarios: 'Funcionários',
  marcacoes_mobile_aprovacao: 'Aprovação Mobile',
}

const ACAO_LABELS: Record<AuditoriaAcao, string> = {
  INSERT: 'Inserção',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
}

function acaoBadgeClass(acao: AuditoriaAcao): string {
  if (acao === 'INSERT') return styles.badgeOk
  if (acao === 'DELETE') return styles.badgeDanger
  return styles.badgeWarn
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function resumoDiff(registro: AuditoriaRegistro): string {
  const antes = registro.dados_anteriores
  const depois = registro.dados_novos
  if (Array.isArray(antes) || Array.isArray(depois)) {
    const n = Array.isArray(antes) ? antes.length : Array.isArray(depois) ? depois.length : 0
    return `${n} registro(s) em lote`
  }
  if (antes && depois) {
    const campos = Object.keys(depois as Record<string, unknown>)
    return campos.map((c) => `${c}: ${String((antes as Record<string, unknown>)[c] ?? '—')} → ${String((depois as Record<string, unknown>)[c] ?? '—')}`).join(', ')
  }
  if (depois) return `criado: ${Object.keys(depois as Record<string, unknown>).slice(0, 3).join(', ')}…`
  if (antes) return 'registro removido'
  return '—'
}

function defaultDataInicio(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function defaultDataFim(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RelatorioAuditoriaTab() {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio())
  const [dataFim, setDataFim] = useState(defaultDataFim())
  const [tabela, setTabela] = useState<AuditoriaTabela | ''>('')
  const [acao, setAcao] = useState<AuditoriaAcao | ''>('')
  const [usuarioId, setUsuarioId] = useState<number | ''>('')
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  const [registros, setRegistros] = useState<AuditoriaRegistro[] | null>(null)
  const [pagination, setPagination] = useState<AuditoriaPagination | null>(null)
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFuncionarios({ limit: 1000 }).then((r) => setFuncionarios(r.data)).catch(() => {})
  }, [])

  const buscar = useCallback(async (targetPage: number) => {
    setError(null)
    setLoading(true)
    try {
      const r = await fetchAuditoria({
        dataInicio,
        dataFim,
        tabela: tabela || undefined,
        acao: acao || undefined,
        usuarioId: usuarioId || undefined,
        page: targetPage,
        limit: 20,
      })
      setRegistros(r.data)
      setPagination(r.pagination)
      setPage(targetPage)
    } catch {
      setError('Erro ao carregar auditoria.')
      setRegistros(null)
    } finally {
      setLoading(false)
    }
  }, [dataInicio, dataFim, tabela, acao, usuarioId])

  const funcionariosOrdenados = useMemo(
    () => [...funcionarios].sort((a, b) => a.nome.localeCompare(b.nome)),
    [funcionarios],
  )

  return (
    <div className={styles.screenSection}>
      <div className={styles.filterBar}>
        <div className={styles.field}>
          <label>Data início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label>Data fim</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label>Tabela</label>
          <select value={tabela} onChange={(e) => setTabela(e.target.value as AuditoriaTabela | '')}>
            <option value="">Todas</option>
            {Object.entries(TABELA_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>Ação</label>
          <select value={acao} onChange={(e) => setAcao(e.target.value as AuditoriaAcao | '')}>
            <option value="">Todas</option>
            {Object.entries(ACAO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>Usuário responsável</label>
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todos</option>
            {funcionariosOrdenados.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>
        <button type="button" className={styles.btnGerar} onClick={() => void buscar(1)} disabled={loading}>
          {loading ? 'Carregando…' : 'Buscar'}
        </button>
      </div>

      {error ? <p className={styles.errorMsg}>{error}</p> : null}

      {registros !== null ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Tabela</th>
                  <th>Registro</th>
                  <th>Alteração</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr><td colSpan={6} className={styles.tableEmpty}>Nenhum registro de auditoria encontrado no período.</td></tr>
                ) : registros.map((r) => (
                  <Fragment key={r.id}>
                    <tr onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                      <td>{r.usuario_nome}</td>
                      <td><span className={acaoBadgeClass(r.acao)}>{ACAO_LABELS[r.acao] ?? r.acao}</span></td>
                      <td>{TABELA_LABELS[r.tabela as AuditoriaTabela] ?? r.tabela}</td>
                      <td>{r.registro_id}</td>
                      <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resumoDiff(r)}
                      </td>
                    </tr>
                    {expandedId === r.id ? (
                      <tr>
                        <td colSpan={6}>
                          <div className={styles.auditDetalhe}>
                            <div>
                              <strong>Valor anterior</strong>
                              <pre>{r.dados_anteriores ? JSON.stringify(r.dados_anteriores, null, 2) : '—'}</pre>
                            </div>
                            <div>
                              <strong>Valor novo</strong>
                              <pre>{r.dados_novos ? JSON.stringify(r.dados_novos, null, 2) : '—'}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className={styles.auditPagination}>
              <button type="button" className={styles.btnGerar} disabled={!pagination.hasPrev || loading} onClick={() => void buscar(page - 1)}>‹ Anterior</button>
              <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total} registro(s))</span>
              <button type="button" className={styles.btnGerar} disabled={!pagination.hasNext || loading} onClick={() => void buscar(page + 1)}>Próxima ›</button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
