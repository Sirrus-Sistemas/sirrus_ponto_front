import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { DatePicker } from '../ui/DatePicker'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  fetchMobileStatus,
  fetchMobileFiliais,
  syncFilial,
  syncFuncionario,
  syncAllFuncionarios,
  pullMarcacoes,
  type FilialMobileItem,
} from '../../services/mobileApi'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import styles from './IntegracaoMobilePage.module.css'

function nowYmd() {
  return new Date().toISOString().slice(0, 10)
}
function prevMonthYmd() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}
function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

export function IntegracaoMobilePage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [configurado, setConfigurado] = useState<boolean | null>(null)
  const [filiais, setFiliais] = useState<FilialMobileItem[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  // Filial selecionada para o filtro de funcionários
  const [filtroFilialId, setFiltroFilialId] = useState<number | ''>('')

  // Sync filial
  const [syncFilialLoading, setSyncFilialLoading] = useState<number | null>(null)
  const [syncFilialMsg, setSyncFilialMsg] = useState<Record<number, string>>({})

  // Sync funcionário individual
  const [syncFuncLoading, setSyncFuncLoading] = useState<number | null>(null)
  const [syncFuncMsg, setSyncFuncMsg] = useState<Record<number, string>>({})

  // Sync todos funcionários
  const [syncAllLoading, setSyncAllLoading] = useState(false)
  const [syncAllResult, setSyncAllResult] = useState<{ sincronizados: number; erros: { funcionario_id: number; error: string }[] } | null>(null)
  const [syncAllError, setSyncAllError] = useState<string | null>(null)

  // Pull marcações
  const [pullFilialId, setPullFilialId] = useState<number | ''>('')
  const [dataInicio, setDataInicio] = useState(prevMonthYmd)
  const [dataFim, setDataFim] = useState(nowYmd)
  const [pullLoading, setPullLoading] = useState(false)
  const [pullResult, setPullResult] = useState<{ importados: number; ignorados: number; erros: { id: number; error: string }[] } | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [status, fils, funcs] = await Promise.all([
        fetchMobileStatus(),
        fetchMobileFiliais(),
        fetchFuncionarios({ limit: 1000, ativo: 1 }),
      ])
      setConfigurado(status.configurado)
      setFiliais(fils)
      setFuncionarios(funcs.data)
    } catch {
      setConfigurado(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Recarrega funcionários quando o filtro de filial muda
  useEffect(() => {
    fetchFuncionarios({ limit: 1000, ativo: 1, filial_id: filtroFilialId || undefined })
      .then((r) => setFuncionarios(r.data))
      .catch(() => {})
  }, [filtroFilialId])

  async function handleSyncFilial(id: number) {
    setSyncFilialLoading(id)
    setSyncFilialMsg((m) => ({ ...m, [id]: '' }))
    try {
      const r = await syncFilial(id)
      setSyncFilialMsg((m) => ({ ...m, [id]: `ID mobile: ${r.pontomobile_id}` }))
      setFiliais((prev) => prev.map((f) => f.id === id ? { ...f, pontomobile_id: r.pontomobile_id } : f))
    } catch (e) {
      setSyncFilialMsg((m) => ({ ...m, [id]: errMsg(e, 'Erro ao sincronizar filial.') }))
    } finally {
      setSyncFilialLoading(null)
    }
  }

  async function handleSyncFuncionario(id: number) {
    setSyncFuncLoading(id)
    setSyncFuncMsg((m) => ({ ...m, [id]: '' }))
    try {
      const r = await syncFuncionario(id)
      setSyncFuncMsg((m) => ({ ...m, [id]: `ID mobile: ${r.pontomobile_id}` }))
    } catch (e) {
      setSyncFuncMsg((m) => ({ ...m, [id]: errMsg(e, 'Erro ao sincronizar.') }))
    } finally {
      setSyncFuncLoading(null)
    }
  }

  async function handleSyncAll() {
    setSyncAllLoading(true)
    setSyncAllResult(null)
    setSyncAllError(null)
    try {
      const r = await syncAllFuncionarios(filtroFilialId || undefined)
      setSyncAllResult(r)
    } catch (e) {
      setSyncAllError(errMsg(e, 'Erro ao sincronizar funcionários.'))
    } finally {
      setSyncAllLoading(false)
    }
  }

  async function handlePull() {
    if (!pullFilialId) return
    setPullLoading(true)
    setPullResult(null)
    setPullError(null)
    try {
      const r = await pullMarcacoes(pullFilialId, dataInicio, dataFim)
      setPullResult(r)
    } catch (e) {
      setPullError(errMsg(e, 'Erro ao importar marcações.'))
    } finally {
      setPullLoading(false)
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>
  if (me?.role !== 'admin') {
    return <p className={styles.denied}>Acesso restrito a administradores.</p>
  }

  const filiaisAtivas = filiais.filter((f) => f.ativa)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Integração Sirrus Ponto Mobile</h1>
      <p className={styles.subtitle}>
        Sincronize filiais e funcionários com o app mobile e importe batidas registradas no aplicativo.
      </p>

      {/* Status banner */}
      <div className={`${styles.banner} ${configurado ? styles.bannerOk : styles.bannerWarn}`}>
        {configurado === null
          ? 'Verificando configuração…'
          : configurado
          ? 'API mobile configurada e acessível.'
          : 'API mobile não configurada. Defina PONTOMOBILE_URL, PONTOMOBILE_CPF e PONTOMOBILE_SENHA no servidor.'}
      </div>

      {/* ── Filiais ─────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Filiais</h2>
        <p className={styles.cardDesc}>
          Cada filial é cadastrada como uma empresa no app mobile. Sincronize antes de enviar funcionários.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>ID Mobile</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filiaisAtivas.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyRow}>Nenhuma filial ativa cadastrada.</td>
                </tr>
              ) : (
                filiaisAtivas.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nome}</td>
                    <td className={styles.tdCpf}>{f.cnpj ?? '—'}</td>
                    <td className={styles.tdMobileId}>
                      {f.pontomobile_id ? (
                        <span className={styles.mobileIdBadge}>{f.pontomobile_id}</span>
                      ) : (
                        <span className={styles.mobileIdEmpty}>—</span>
                      )}
                    </td>
                    <td className={styles.tdAcao}>
                      <div className={styles.acaoRow}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => void handleSyncFilial(f.id)}
                          disabled={syncFilialLoading === f.id || !configurado}
                        >
                          {syncFilialLoading === f.id ? '…' : 'Sincronizar'}
                        </button>
                        {syncFilialMsg[f.id] ? (
                          <span className={styles.inlineMsgSm}>{syncFilialMsg[f.id]}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Funcionários ────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Funcionários</h2>
        <p className={styles.cardDesc}>
          Sincronize individualmente ou use "Sincronizar Todos" para enviar todos de uma vez.
        </p>

        {/* Barra de filtro + sync todos */}
        <div className={styles.funcBar}>
          <div className={styles.field}>
            <label htmlFor="filtro-filial">Filtrar por filial</label>
            <select
              id="filtro-filial"
              value={filtroFilialId}
              onChange={(e) => setFiltroFilialId(e.target.value ? Number(e.target.value) : '')}
              className={styles.select}
            >
              <option value="">Todas as filiais</option>
              {filiaisAtivas.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void handleSyncAll()}
            disabled={syncAllLoading || !configurado}
            style={{ alignSelf: 'flex-end' }}
          >
            {syncAllLoading
              ? 'Sincronizando…'
              : filtroFilialId
              ? 'Sincronizar Todos desta Filial'
              : 'Sincronizar Todos'}
          </button>
        </div>

        {syncAllError ? (
          <p className={styles.error} role="alert">{syncAllError}</p>
        ) : null}

        {syncAllResult ? (
          <div className={styles.pullResult} style={{ marginBottom: '0.75rem' }}>
            <span className={styles.resultOk}>{syncAllResult.sincronizados} sincronizado(s)</span>
            {syncAllResult.erros.length > 0 ? (
              <span className={styles.resultErr}>{syncAllResult.erros.length} erro(s)</span>
            ) : null}
          </div>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Filial</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {funcionarios.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyRow}>Nenhum funcionário encontrado.</td>
                </tr>
              ) : (
                funcionarios.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nome}</td>
                    <td className={styles.tdCpf}>{f.cpf ?? '—'}</td>
                    <td className={styles.tdFilial}>{f.filial_nome ?? '—'}</td>
                    <td className={styles.tdAcao}>
                      <div className={styles.acaoRow}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => void handleSyncFuncionario(f.id)}
                          disabled={syncFuncLoading === f.id || !configurado}
                        >
                          {syncFuncLoading === f.id ? '…' : 'Sincronizar'}
                        </button>
                        {syncFuncMsg[f.id] ? (
                          <span className={styles.inlineMsgSm}>{syncFuncMsg[f.id]}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Importar Marcações ───────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Importar Marcações</h2>
        <p className={styles.cardDesc}>
          Busca batidas registradas no app mobile no período selecionado e insere no sistema
          (duplicatas são ignoradas automaticamente).
        </p>
        <div className={styles.pullForm}>
          <div className={styles.field}>
            <label htmlFor="pull-filial">Filial</label>
            <select
              id="pull-filial"
              value={pullFilialId}
              onChange={(e) => setPullFilialId(e.target.value ? Number(e.target.value) : '')}
              className={styles.select}
            >
              <option value="">Selecione a filial</option>
              {filiaisAtivas.filter((f) => f.pontomobile_id).map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="pull-inicio">Data inicial</label>
            <DatePicker
              id="pull-inicio"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="pull-fim">Data final</label>
            <DatePicker
              id="pull-fim"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void handlePull()}
            disabled={pullLoading || !configurado || !pullFilialId}
            style={{ alignSelf: 'flex-end' }}
          >
            {pullLoading ? 'Importando…' : 'Importar Marcações'}
          </button>
        </div>

        {pullError ? (
          <p className={styles.error} role="alert">{pullError}</p>
        ) : null}

        {pullResult ? (
          <div className={styles.pullResult}>
            <span className={styles.resultOk}>{pullResult.importados} batida(s) importada(s)</span>
            <span className={styles.resultIgn}>{pullResult.ignorados} ignorada(s)</span>
            {pullResult.erros.length > 0 ? (
              <span className={styles.resultErr}>{pullResult.erros.length} erro(s)</span>
            ) : null}
            {pullResult.erros.length > 0 ? (
              <details style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#b91c1c', gridColumn: '1/-1' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ver detalhes dos erros</summary>
                <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                  {pullResult.erros.slice(0, 10).map((e, i) => (
                    <li key={i}>ID {e.id}: {e.error}</li>
                  ))}
                  {pullResult.erros.length > 10 && (
                    <li>... e mais {pullResult.erros.length - 10} erro(s)</li>
                  )}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
