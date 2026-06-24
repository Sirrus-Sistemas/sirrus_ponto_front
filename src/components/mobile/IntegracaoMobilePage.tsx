import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import 'dayjs/locale/pt-br'
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
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import styles from './IntegracaoMobilePage.module.css'

dayjs.locale('pt-br')

// Estilo do popup do calendário (branco, alinhado com o sistema)
const muiPopupSlotProps = {
  popper: {
    sx: {
      zIndex: 9999,
      '& .MuiPaper-root': {
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff !important',
        color: '#1f2937',
      },
      '& .MuiDateCalendar-root': {
        backgroundColor: '#ffffff',
        color: '#1f2937',
      },
      '& .MuiPickersCalendarHeader-root': {
        backgroundColor: '#ffffff',
      },
      '& .MuiPickersCalendarHeader-label': {
        fontWeight: 700,
        color: '#1a3c38',
      },
      '& .MuiDayCalendar-header': {
        backgroundColor: '#ffffff',
      },
      '& .MuiDayCalendar-weekDayLabel': {
        color: '#6b7280',
        fontWeight: 600,
        fontSize: '0.78rem',
        backgroundColor: '#ffffff',
      },
      '& .MuiPickersDay-root': {
        borderRadius: '8px',
        color: '#1f2937',
        fontSize: '0.85rem',
        backgroundColor: 'transparent',
      },
      '& .MuiPickersDay-root:hover': {
        backgroundColor: '#e8f5f3',
      },
      '& .MuiPickersDay-root.Mui-selected': {
        backgroundColor: '#2a7a6f !important',
        color: '#fff',
      },
      '& .MuiPickersDay-root.Mui-selected:hover': {
        backgroundColor: '#1a5c52 !important',
      },
      '& .MuiPickersDay-today:not(.Mui-selected)': {
        border: '1px solid #2a7a6f',
        color: '#2a7a6f',
      },
      '& .MuiPickersArrowSwitcher-button': {
        color: '#1a3c38',
      },
    },
  },
}
function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}
function formatTimestamp(date: Date) {
  const hoje = new Date()
  const isToday =
    date.getDate() === hoje.getDate() &&
    date.getMonth() === hoje.getMonth() &&
    date.getFullYear() === hoje.getFullYear()
  const hhmm = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return isToday ? `hoje ${hhmm}` : date.toLocaleDateString('pt-BR') + ' ' + hhmm
}

function IconMobile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
}
function IconPeople() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

export function IntegracaoMobilePage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [configurado, setConfigurado] = useState<boolean | null>(null)
  const [filiais, setFiliais] = useState<FilialMobileItem[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  const [filtroFilialId, setFiltroFilialId] = useState<number | ''>('')
  const [filtroLotacaoId, setFiltroLotacaoId] = useState<number | ''>('')
  const [filtroNome, setFiltroNome] = useState('')
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [funcPage, setFuncPage] = useState(0)
  const FUNC_PAGE_SIZE = 10

  const [syncFilialLoading, setSyncFilialLoading] = useState<number | null>(null)

  const [syncFuncLoading, setSyncFuncLoading] = useState<number | null>(null)
  const [syncFuncMsg, setSyncFuncMsg] = useState<Record<number, string>>({})

  const [syncAllLoading, setSyncAllLoading] = useState(false)
  const [syncAllResult, setSyncAllResult] = useState<{ sincronizados: number; erros: { funcionario_id: number; error: string }[] } | null>(null)
  const [syncAllError, setSyncAllError] = useState<string | null>(null)

  const [pullFilialId, setPullFilialId] = useState<number | ''>('')
  const [pullLotacaoId, setPullLotacaoId] = useState<number | ''>('')
  const [pullFuncionarioId, setPullFuncionarioId] = useState<number | ''>('')
  const [pullFuncionarios, setPullFuncionarios] = useState<FuncionarioListItem[]>([])
  const [dataInicio, setDataInicio] = useState<Dayjs | null>(() => dayjs().startOf('month'))
  const [dataFim, setDataFim] = useState<Dayjs | null>(() => dayjs())
  const [pullLoading, setPullLoading] = useState(false)
  const [pullResult, setPullResult] = useState<{ importados: number; ignorados: number; erros: { id: number; error: string }[] } | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)
  const [pullTimestamp, setPullTimestamp] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const [status, fils, funcs, lots] = await Promise.all([
        fetchMobileStatus(),
        fetchMobileFiliais(),
        fetchFuncionarios({ limit: 1000, ativo: 1 }),
        fetchLotacoes(),
      ])
      setConfigurado(status.configurado)
      setFiliais(fils)
      setFuncionarios(funcs.data)
      setLotacoes(lots)
    } catch {
      setConfigurado(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    fetchFuncionarios({
      limit: 1000,
      ativo: 1,
      filial_id: filtroFilialId || undefined,
      lotacao_id: filtroLotacaoId || undefined,
    })
      .then((r) => { setFuncionarios(r.data); setFuncPage(0) })
      .catch(() => {})
  }, [filtroFilialId, filtroLotacaoId])

  useEffect(() => {
    setPullFuncionarioId('')
    if (!pullFilialId) { setPullFuncionarios([]); return }
    fetchFuncionarios({
      limit: 1000,
      ativo: 1,
      filial_id: pullFilialId,
      lotacao_id: pullLotacaoId || undefined,
    })
      .then((r) => setPullFuncionarios(r.data))
      .catch(() => {})
  }, [pullFilialId, pullLotacaoId])

  async function handleSyncFilial(id: number) {
    setSyncFilialLoading(id)
    try {
      const r = await syncFilial(id)
      setFiliais((prev) => prev.map((f) => (f.id === id ? { ...f, pontomobile_id: r.pontomobile_id } : f)))
    } catch {
      // erro silencioso — filial não muda de estado
    } finally {
      setSyncFilialLoading(null)
    }
  }

  async function handleSyncFuncionario(id: number) {
    setSyncFuncLoading(id)
    setSyncFuncMsg((m) => ({ ...m, [id]: '' }))
    try {
      const r = await syncFuncionario(id)
      setSyncFuncMsg((m) => ({ ...m, [id]: `ok:${r.pontomobile_id}` }))
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
      const r = await pullMarcacoes(
        pullFilialId,
        dataInicio?.format('YYYY-MM-DD') ?? '',
        dataFim?.format('YYYY-MM-DD') ?? '',
        pullLotacaoId || undefined,
        pullFuncionarioId || undefined,
      )
      setPullResult(r)
      setPullTimestamp(new Date())
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
  const funcionariosFiltrados = filtroNome.trim()
    ? funcionarios.filter((f) => f.nome.toLowerCase().includes(filtroNome.trim().toLowerCase()))
    : funcionarios
  const totalPages = Math.ceil(funcionariosFiltrados.length / FUNC_PAGE_SIZE)

  return (
    <div className={styles.page}>

      {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Integração Ponto Mobile</h1>
          <p className={styles.subtitle}>
            Sincronize filiais e funcionários com o app e importe as batidas registradas no aplicativo.
          </p>
        </div>
        <div className={`${styles.statusBadge} ${configurado ? styles.statusOk : styles.statusWarn}`}>
          <span className={styles.statusDot} />
          {configurado === null
            ? 'Verificando…'
            : configurado
            ? 'API mobile conectada e acessível'
            : 'API mobile não configurada'}
        </div>
      </div>

      {/* ── Importar Marcações ───────────────────────────────────────────── */}
      <div className={styles.importCard}>
        <div className={styles.importCardHeader}>
          <div className={styles.importIcon}><IconMobile /></div>
          <div>
            <h2 className={styles.importTitle}>Importar marcações</h2>
            <p className={styles.importDesc}>
              Busca as batidas do app no período e insere no sistema — duplicatas são ignoradas.
            </p>
          </div>
        </div>

        <div className={styles.pullForm}>
          <div className={styles.fieldDark}>
            <label>FILIAL</label>
            <select
              value={pullFilialId}
              onChange={(e) => { setPullFilialId(e.target.value ? Number(e.target.value) : ''); setPullLotacaoId('') }}
              className={styles.selectDark}
            >
              <option value="">Selecione a filial</option>
              {filiaisAtivas.filter((f) => f.pontomobile_id).map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldDark}>
            <label>LOTAÇÃO</label>
            <select
              value={pullLotacaoId}
              onChange={(e) => setPullLotacaoId(e.target.value ? Number(e.target.value) : '')}
              className={styles.selectDark}
            >
              <option value="">Todas as lotações</option>
              {lotacoes.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldDark}>
            <label>COLABORADOR</label>
            <select
              value={pullFuncionarioId}
              onChange={(e) => setPullFuncionarioId(e.target.value ? Number(e.target.value) : '')}
              className={styles.selectDark}
              disabled={!pullFilialId}
              style={{ minWidth: '200px' }}
            >
              <option value="">Todos os colaboradores</option>
              {pullFuncionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <div className={styles.fieldDark}>
              <label>DATA INICIAL</label>
              <div className={styles.datepickerWrap}>
                <MuiDatePicker
                  value={dataInicio}
                  onChange={(v: Dayjs | null) => setDataInicio(v)}
                  referenceDate={dayjs()}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { size: 'small' }, ...muiPopupSlotProps }}
                />
              </div>
            </div>
            <div className={styles.fieldDark}>
              <label>DATA FINAL</label>
              <div className={styles.datepickerWrap}>
                <MuiDatePicker
                  value={dataFim}
                  onChange={(v: Dayjs | null) => setDataFim(v)}
                  referenceDate={dayjs()}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { size: 'small' }, ...muiPopupSlotProps }}
                />
              </div>
            </div>
          </LocalizationProvider>
          <button
            type="button"
            className={styles.btnImportar}
            onClick={() => void handlePull()}
            disabled={pullLoading || !configurado || !pullFilialId}
          >
            {pullLoading ? 'Importando…' : 'Importar'}
          </button>
        </div>

        {pullError ? (
          <p className={styles.pullErrorMsg} role="alert">{pullError}</p>
        ) : null}

        {pullResult ? (
          <div className={styles.pullPills}>
            <span className={styles.pillOk}>✓ {pullResult.importados} batida{pullResult.importados !== 1 ? 's' : ''} importada{pullResult.importados !== 1 ? 's' : ''}</span>
            <span className={styles.pillIgn}>{pullResult.ignorados} ignorada{pullResult.ignorados !== 1 ? 's' : ''} (duplicatas)</span>
            {pullTimestamp && (
              <span className={styles.pillTime}>última: {formatTimestamp(pullTimestamp)}</span>
            )}
            {pullResult.erros.length > 0 && (
              <span className={styles.pillErr}>{pullResult.erros.length} erro(s)</span>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Funcionários + Filiais ───────────────────────────────────────── */}
      <div className={styles.twoCol}>

        {/* Funcionários */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardIcon}><IconPeople /></div>
            <div>
              <h2 className={styles.cardTitle}>Funcionários</h2>
              <p className={styles.cardDesc}>Sincronize individualmente ou todos de uma vez.</p>
            </div>
          </div>

          <div className={styles.funcBar}>
            <div className={styles.funcBarFilters}>
              <div className={styles.fieldGroup}>
                <label className={styles.filterLabel}>BUSCAR POR NOME</label>
                <input
                  type="search"
                  placeholder="Digite o nome…"
                  value={filtroNome}
                  onChange={(e) => { setFiltroNome(e.target.value); setFuncPage(0) }}
                  className={styles.inputSearch}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.filterLabel}>FILTRAR POR FILIAL</label>
                <select
                  value={filtroFilialId}
                  onChange={(e) => { setFiltroFilialId(e.target.value ? Number(e.target.value) : ''); setFuncPage(0) }}
                  className={styles.select}
                >
                  <option value="">Todas as filiais</option>
                  {filiaisAtivas.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.filterLabel}>LOTAÇÃO</label>
                <select
                  value={filtroLotacaoId}
                  onChange={(e) => { setFiltroLotacaoId(e.target.value ? Number(e.target.value) : ''); setFuncPage(0) }}
                  className={`${styles.select} ${styles.selectSm}`}
                >
                  <option value="">Todas</option>
                  {lotacoes.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void handleSyncAll()}
              disabled={syncAllLoading || !configurado}
            >
              {syncAllLoading ? 'Sincronizando…' : 'Sincronizar todos'}
            </button>
          </div>

          {syncAllError ? (
            <p className={styles.error} role="alert">{syncAllError}</p>
          ) : null}
          {syncAllResult ? (
            <div className={styles.syncAllResult}>
              <span className={styles.pillOkSm}>{syncAllResult.sincronizados} sincronizado(s)</span>
              {syncAllResult.erros.length > 0 && (
                <span className={styles.pillErrSm}>{syncAllResult.erros.length} erro(s)</span>
              )}
            </div>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>CPF</th>
                  <th>SYNC</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {funcionariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyRow}>Nenhum funcionário encontrado.</td>
                  </tr>
                ) : (
                  funcionariosFiltrados.slice(funcPage * FUNC_PAGE_SIZE, (funcPage + 1) * FUNC_PAGE_SIZE).map((f) => {
                    const msg = syncFuncMsg[f.id] ?? ''
                    const synced = msg.startsWith('ok:')
                    const mobileId = synced ? msg.slice(3) : null
                    const errored = msg && !synced
                    return (
                      <tr key={f.id}>
                        <td>{f.nome}</td>
                        <td className={styles.tdCpf}>{f.cpf ?? '—'}</td>
                        <td>
                          {synced ? (
                            <span className={styles.syncOkMsg}>✓ ID {mobileId}</span>
                          ) : errored ? (
                            <span className={styles.syncErrMsg}>{msg}</span>
                          ) : (
                            <span className={styles.dotGrey} />
                          )}
                        </td>
                        <td className={styles.tdAcao}>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => void handleSyncFuncionario(f.id)}
                            disabled={syncFuncLoading === f.id || !configurado}
                          >
                            {syncFuncLoading === f.id ? '…' : 'Sincronizar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {funcionariosFiltrados.length > FUNC_PAGE_SIZE && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setFuncPage((p) => p - 1)}
                disabled={funcPage === 0}
              >‹</button>
              <span className={styles.pageInfo}>{funcPage + 1} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                onClick={() => setFuncPage((p) => p + 1)}
                disabled={(funcPage + 1) * FUNC_PAGE_SIZE >= funcionariosFiltrados.length}
              >›</button>
            </div>
          )}
        </div>

        {/* Filiais */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardIcon}><IconBuilding /></div>
            <div>
              <h2 className={styles.cardTitle}>Filiais</h2>
              <p className={styles.cardDesc}>Sincronize antes de enviar funcionários.</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>ID MOBILE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filiaisAtivas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.emptyRow}>Nenhuma filial ativa cadastrada.</td>
                  </tr>
                ) : (
                  filiaisAtivas.map((f) => (
                    <tr key={f.id}>
                      <td>{f.nome}</td>
                      <td className={styles.tdMobileId}>
                        {f.pontomobile_id ? (
                          <span className={styles.mobileIdBadge}>{f.pontomobile_id}</span>
                        ) : (
                          <span className={styles.mobileIdEmpty}>—</span>
                        )}
                      </td>
                      <td className={styles.tdAcao}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => void handleSyncFilial(f.id)}
                          disabled={syncFilialLoading === f.id || !configurado}
                        >
                          {syncFilialLoading === f.id
                            ? '…'
                            : f.pontomobile_id
                            ? 'Re-sync'
                            : 'Sincronizar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
