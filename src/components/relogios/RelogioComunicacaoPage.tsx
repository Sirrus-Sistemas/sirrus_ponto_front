import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchRelogios, MODELOS_RELOGIO, type Relogio } from '../../services/relogiosApi'
import {
  fetchFila,
  fetchContadores,
  fetchSaude,
  enqueueManual,
  retentarErros,
  removerDaFila,
  type FilaItem,
  type FilaStatus,
  type ContadorFila,
  type SistemasSaude,
} from '../../services/relogioSyncApi'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import styles from './RelogioComunicacaoPage.module.css'

function modeloLabel(v: string) {
  return MODELOS_RELOGIO.find((m) => m.value === v)?.label ?? v
}

function cpfMask(s: string | null | undefined) {
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length !== 11) return s
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function RelogioComunicacaoPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [relogios, setRelogios]         = useState<Relogio[]>([])
  const [contadores, setContadores]     = useState<ContadorFila[]>([])
  const [saude, setSaude]               = useState<SistemasSaude>(null)
  const [selectedId, setSelectedId]     = useState<number | null>(null)
  const [fila, setFila]                 = useState<FilaItem[]>([])
  const [loadingFila, setLoadingFila]   = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<FilaStatus | ''>('')
  const [search, setSearch]             = useState('')
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<string | null>(null)
  const [retentando, setRetentando]     = useState(false)

  // Modal de adição manual
  const [modalOpen, setModalOpen]         = useState(false)
  const [modalFuncs, setModalFuncs]       = useState<FuncionarioListItem[]>([])
  const [modalSearch, setModalSearch]     = useState('')
  const [modalSelected, setModalSelected] = useState<Set<number>>(new Set())
  const [modalOp, setModalOp]             = useState<'inserir' | 'atualizar' | 'excluir'>('excluir')
  const [modalSaving, setModalSaving]     = useState(false)

  const selectedRelogio = relogios.find((r) => r.id === selectedId) ?? null

  const loadBase = useCallback(async () => {
    try {
      const [r, c, s] = await Promise.all([fetchRelogios(), fetchContadores(), fetchSaude()])
      setRelogios(r)
      setContadores(c)
      setSaude(s)
    } catch { /* silent */ }
  }, [])

  const loadFila = useCallback(async (relogioId: number, silent = false) => {
    if (!silent) setLoadingFila(true)
    try {
      const data = await fetchFila(relogioId, {
        status: filtroStatus || undefined,
        search: search || undefined,
      })
      setFila(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar fila.')
    } finally {
      if (!silent) setLoadingFila(false)
    }
  }, [filtroStatus, search])

  useEffect(() => { void loadBase() }, [loadBase])

  useEffect(() => {
    if (selectedId !== null) void loadFila(selectedId)
  }, [selectedId, loadFila])

  function selectRelogio(id: number) {
    setSelectedId(id)
    setError(null)
    setSuccess(null)
    setFila([])
  }

  function contador(relogioId: number) {
    return contadores.find((c) => c.relogio_id === relogioId)
  }

  async function handleRetentar() {
    if (!selectedId) return
    setRetentando(true)
    setError(null)
    try {
      const total = await retentarErros(selectedId)
      setSuccess(`${total} item(ns) marcado(s) para reenvio.`)
      await Promise.all([loadFila(selectedId, true), loadBase()])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao retentar.')
    } finally {
      setRetentando(false)
    }
  }

  async function handleRemover(filaId: number) {
    if (!selectedId) return
    try {
      await removerDaFila(filaId, selectedId)
      setFila((prev) => prev.filter((i) => i.id !== filaId))
      void loadBase()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao remover.')
    }
  }

  // Modal
  async function abrirModal() {
    setModalSearch('')
    setModalSelected(new Set())
    setModalOp('excluir')
    setModalOpen(true)
    try {
      const data = await fetchFuncionarios({ ativo: 1 })
      setModalFuncs(data.data)
    } catch { setModalFuncs([]) }
  }

  function toggleFunc(id: number) {
    setModalSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleModalConfirm() {
    if (!selectedId || modalSelected.size === 0) return
    setModalSaving(true)
    setError(null)
    try {
      for (const funcId of modalSelected) {
        await enqueueManual(selectedId, funcId, modalOp)
      }
      setSuccess(`${modalSelected.size} funcionário(s) adicionado(s) à fila.`)
      setModalOpen(false)
      await Promise.all([loadFila(selectedId, true), loadBase()])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enfileirar.')
    } finally {
      setModalSaving(false)
    }
  }

  const modalFiltered = useMemo(() => {
    if (!modalSearch) return modalFuncs
    const q = modalSearch.toLowerCase()
    return modalFuncs.filter((f) => f.nome.toLowerCase().includes(q))
  }, [modalFuncs, modalSearch])

  const temErros = fila.some((i) => i.status === 'erro')

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me || me.role !== 'admin') {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Acesso restrito</h2>
        <p><Link to="/dashboard">Voltar</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Comunicação com Equipamentos</h1>
          <p className={styles.subtitle}>
            Gerencie a fila de sincronização de funcionários nos relógios de ponto.
            Novos cadastros e edições são enfileirados automaticamente para relógios de rede.
          </p>
        </div>
      </div>

      <SaudeCard saude={saude} relogios={relogios} />

      <div className={styles.layout}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLabel}>EQUIPAMENTOS</div>
          {relogios.length === 0 ? (
            <p className={styles.emptyList}>Nenhum relógio cadastrado.</p>
          ) : (
            <ul className={styles.relogioList}>
              {relogios.map((r) => {
                const c = contador(r.id)
                return (
                  <li
                    key={r.id}
                    className={`${styles.relogioCard} ${selectedId === r.id ? styles.relogioCardActive : ''}`}
                    onClick={() => selectRelogio(r.id)}
                  >
                    <div className={styles.cardRow}>
                      <span className={styles.cardNome}>{r.descricao}</span>
                      <span style={{ display: 'flex', gap: '4px' }}>
                        {c && Number(c.total_pendente) > 0 && (
                          <span className={styles.badgePendente}>{c.total_pendente}</span>
                        )}
                        {c && Number(c.total_erro) > 0 && (
                          <span className={styles.badgeErro}>{c.total_erro}</span>
                        )}
                      </span>
                    </div>
                    <div className={styles.cardRow}>
                      <span className={styles.cardMeta}>{modeloLabel(r.modelo)}</span>
                      {r.usa_afd && <span className={styles.cardMeta}>AFD</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* ── Main panel ── */}
        <main className={styles.main}>
          {!selectedRelogio ? (
            <div className={styles.idleState}>
              <svg className={styles.idleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              <p>Selecione um relógio para ver a fila de sincronização</p>
            </div>
          ) : (
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>{selectedRelogio.descricao}</h2>
                  <p className={styles.panelSub}>
                    {modeloLabel(selectedRelogio.modelo)} · Série {selectedRelogio.numero_serie}
                    {selectedRelogio.usa_afd ? ' · AFD (sem sincronização automática)' : ''}
                  </p>
                </div>
                <div className={styles.panelActions}>
                  {temErros && (
                    <button
                      type="button"
                      className={styles.btnAction}
                      onClick={() => void handleRetentar()}
                      disabled={retentando}
                    >
                      {retentando ? 'Reenviando…' : 'Retentar erros'}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.btnAction} ${styles.btnPrimary}`}
                    onClick={() => void abrirModal()}
                  >
                    + Adicionar à fila
                  </button>
                </div>
              </div>

              {error   && <p className={`${styles.feedback} ${styles.feedbackError}`}>{error}</p>}
              {success && <p className={`${styles.feedback} ${styles.feedbackOk}`}>{success}</p>}

              <div className={styles.filters}>
                <div className={styles.filterGroup}>
                  {(['', 'pendente', 'erro', 'enviado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.filterBtn} ${filtroStatus === s ? styles.filterBtnActive : ''}`}
                      onClick={() => setFiltroStatus(s)}
                    >
                      {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className={styles.searchWrapper}>
                  <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    className={styles.searchInput}
                    type="search"
                    placeholder="Buscar funcionário…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.tableWrap}>
                {loadingFila ? (
                  <p className={styles.emptyTable}>Carregando…</p>
                ) : fila.length === 0 ? (
                  <p className={styles.emptyTable}>Nenhum item na fila para os filtros selecionados.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Funcionário</th>
                        <th>CPF / PIS</th>
                        <th>Operação</th>
                        <th>Status</th>
                        <th>Tentativas</th>
                        <th>Atualizado em</th>
                        <th>Erro</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fila.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className={styles.tdName}>{item.nome}</div>
                            {item.lotacao_nome && <div className={styles.tdMeta}>{item.lotacao_nome}</div>}
                          </td>
                          <td>
                            <div className={styles.tdCode}>{cpfMask(item.cpf)}</div>
                            {item.pis && <div className={styles.tdCode}>{item.pis}</div>}
                          </td>
                          <td>
                            <span className={`${styles.opBadge} ${
                              item.operacao === 'inserir'   ? styles.opInserir
                            : item.operacao === 'atualizar' ? styles.opAtualizar
                            : styles.opExcluir}`}>
                              {item.operacao}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.stBadge} ${
                              item.status === 'pendente' ? styles.stPendente
                            : item.status === 'enviado'  ? styles.stEnviado
                            : styles.stErro}`}>
                              <span className={styles.stDot} />
                              {item.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{item.tentativas}</td>
                          <td className={styles.tdMeta}>{formatDate(item.atualizado_em)}</td>
                          <td>
                            {item.erro_msg && (
                              <span className={styles.erroText} title={item.erro_msg}>
                                {item.erro_msg}
                              </span>
                            )}
                          </td>
                          <td>
                            {item.status !== 'enviado' && (
                              <button
                                type="button"
                                className={styles.btnRemove}
                                title="Remover da fila"
                                onClick={() => void handleRemover(item.id)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modal de adição manual ── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className={styles.modal}>
            <div>
              <h3 className={styles.modalTitle}>Adicionar funcionários à fila</h3>
              <p className={styles.modalSub}>
                Selecione os funcionários e a operação desejada para {selectedRelogio?.descricao}.
              </p>
            </div>

            <div className={styles.modalField}>
              <label>OPERAÇÃO</label>
              <select value={modalOp} onChange={(e) => setModalOp(e.target.value as typeof modalOp)}>
                <option value="inserir">Inserir no equipamento</option>
                <option value="atualizar">Atualizar no equipamento</option>
                <option value="excluir">Excluir do equipamento</option>
              </select>
            </div>

            <div className={styles.modalField}>
              <label>BUSCAR FUNCIONÁRIO</label>
              <input
                type="search"
                placeholder="Nome…"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.funcList}>
              {modalFiltered.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--sp-text-3)', fontSize: '0.88rem' }}>
                  Nenhum funcionário encontrado.
                </div>
              ) : modalFiltered.map((f) => {
                const sel = modalSelected.has(f.id)
                return (
                  <div
                    key={f.id}
                    className={`${styles.funcItem} ${sel ? styles.funcItemSelected : ''}`}
                    onClick={() => toggleFunc(f.id)}
                  >
                    <div className={`${styles.funcCheckbox} ${sel ? styles.funcCheckboxOn : ''}`}>
                      {sel && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className={styles.funcNome}>{f.nome}</div>
                      <div className={styles.funcMeta}>
                        {cpfMask(f.cpf)}{f.lotacao_nome ? ` · ${f.lotacao_nome}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnConfirm}
                disabled={modalSelected.size === 0 || modalSaving}
                onClick={() => void handleModalConfirm()}
              >
                {modalSaving
                  ? 'Salvando…'
                  : `Confirmar (${modalSelected.size} selecionado${modalSelected.size !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente de saúde do sistema ──────────────────────────────────────────

const OFFLINE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutos

function SaudeCard({ saude, relogios }: { saude: SistemasSaude; relogios: Relogio[] }) {
  if (!saude) {
    return (
      <div className={styles.saudeCard} style={{ borderColor: 'var(--sp-border)' }}>
        <div className={styles.saudeDot} style={{ background: '#d1d5db' }} />
        <div className={styles.saudeInfo}>
          <span className={styles.saudeLabel}>Sistema de coleta</span>
          <span className={styles.saudeSub}>Nenhum heartbeat recebido ainda.</span>
        </div>
      </div>
    )
  }

  const agora = Date.now()
  const recebido = new Date(saude.recebido_em).getTime()
  const semComunicacao = agora - recebido > OFFLINE_THRESHOLD_MS
  const dotColor = semComunicacao ? '#ef4444' : saude.status === 'online' ? '#22c55e' : '#f59e0b'
  const label = semComunicacao ? 'Sem comunicação' : saude.status ?? 'desconhecido'
  const minutosAtras = Math.round((agora - recebido) / 60000)

  function relogioNome(id: number) {
    return relogios.find((r) => r.id === id)?.descricao ?? `Relógio #${id}`
  }

  return (
    <div className={styles.saudeCard} style={{ borderColor: dotColor + '44' }}>
      <div className={styles.saudeDot} style={{ background: dotColor }} />
      <div className={styles.saudeInfo}>
        <span className={styles.saudeLabel}>
          Sistema de coleta&nbsp;
          {saude.versao && <span className={styles.saudeVersao}>v{saude.versao}</span>}
          &nbsp;·&nbsp;
          <strong style={{ color: dotColor }}>{label}</strong>
        </span>
        <span className={styles.saudeSub}>
          Último heartbeat: {minutosAtras === 0 ? 'agora mesmo' : `${minutosAtras} min atrás`}
          {saude.ultimo_sync && ` · Último sync: ${formatDate(saude.ultimo_sync)}`}
        </span>
      </div>
      {saude.relogios && saude.relogios.length > 0 && (
        <div className={styles.saudeRelogios}>
          {saude.relogios.map((r) => (
            <span
              key={r.id}
              className={styles.saudeRelogioPill}
              style={{ background: r.status === 'ok' ? '#dcfce7' : '#fee2e2',
                       color: r.status === 'ok' ? '#166534' : '#991b1b' }}
              title={r.erro ?? ''}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.status === 'ok' ? '#22c55e' : '#ef4444', display: 'inline-block', marginRight: 4 }} />
              {relogioNome(r.id)}
              {r.erro && ` — ${r.erro}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
