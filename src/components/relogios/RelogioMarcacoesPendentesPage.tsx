import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchRelogios, type Relogio } from '../../services/relogiosApi'
import {
  fetchMarcacoesPendentes,
  vincularMarcacaoPendente,
  excluirMarcacaoPendente,
  validarTodasPendentes,
  type MarcacaoPendente,
} from '../../services/relogioMarcacoesPendentesApi'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import styles from './RelogioComunicacaoPage.module.css'

function cpfMask(s: string | null | undefined) {
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length !== 11) return s
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const POR_PAGINA = 50

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function RelogioMarcacoesPendentesPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [relogios, setRelogios] = useState<Relogio[]>([])
  const [relogioFiltro, setRelogioFiltro] = useState<number | ''>('')
  const [pendentes, setPendentes] = useState<MarcacaoPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [validando, setValidando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)

  // Modal de vínculo manual
  const [vincularAlvo, setVincularAlvo] = useState<MarcacaoPendente | null>(null)
  const [modalFuncs, setModalFuncs] = useState<FuncionarioListItem[]>([])
  const [modalSearch, setModalSearch] = useState('')
  const [modalSelected, setModalSelected] = useState<number | null>(null)
  const [modalSaving, setModalSaving] = useState(false)

  const loadRelogios = useCallback(async () => {
    try {
      setRelogios(await fetchRelogios())
    } catch {
      /* silent */
    }
  }, [])

  const loadPendentes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetchMarcacoesPendentes({
        relogioId: relogioFiltro || undefined,
        search: search || undefined,
        page: pagina,
        limit: POR_PAGINA,
      })
      // Vincular os últimos itens da última página a deixa vazia — volta uma.
      if (res.data.length === 0 && pagina > 1) { setPagina((p) => p - 1); return }
      setPendentes(res.data)
      setTotal(res.pagination.total)
      setTotalPaginas(Math.max(1, res.pagination.totalPages))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar marcações pendentes.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [relogioFiltro, search, pagina])

  useEffect(() => { void loadRelogios() }, [loadRelogios])
  useEffect(() => { void loadPendentes() }, [loadPendentes])

  async function handleValidarTodos() {
    setValidando(true)
    setError(null)
    setSuccess(null)
    try {
      const r = await validarTodasPendentes()
      setSuccess(
        r.vinculadas > 0
          ? `${r.vinculadas} marcação(ões) vinculada(s) automaticamente — cadastro já estava correto.`
          : 'Nenhuma marcação pendente bateu com o cadastro atual.',
      )
      await loadPendentes(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao validar marcações pendentes.')
    } finally {
      setValidando(false)
    }
  }

  async function handleExcluir(item: MarcacaoPendente) {
    if (!confirm(
      `Excluir definitivamente esta marcação pendente (${cpfMask(item.cpf)}${item.pis ? ` · PIS ${item.pis}` : ''} em ${formatDate(item.data_hora)})?\n\n` +
      'Use para batidas de teste (ex.: funcionário fantasma cadastrado só pra testar o relógio) que nunca vão ter um cadastro correspondente.',
    )) return
    setExcluindoId(item.id)
    setError(null)
    setSuccess(null)
    try {
      await excluirMarcacaoPendente(item.id)
      setSuccess('Marcação pendente excluída.')
      await loadPendentes(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir marcação pendente.')
    } finally {
      setExcluindoId(null)
    }
  }

  function abrirVincular(item: MarcacaoPendente) {
    setVincularAlvo(item)
    setModalSearch('')
    setModalSelected(null)
    setError(null)
    setSuccess(null)
    fetchFuncionarios({ ativo: 1 }).then((d) => setModalFuncs(d.data)).catch(() => setModalFuncs([]))
  }

  async function confirmarVinculo() {
    if (!vincularAlvo || modalSelected === null) return
    setModalSaving(true)
    setError(null)
    try {
      await vincularMarcacaoPendente(vincularAlvo.id, modalSelected)
      setSuccess('Marcação vinculada com sucesso.')
      setVincularAlvo(null)
      await loadPendentes(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao vincular marcação.')
    } finally {
      setModalSaving(false)
    }
  }

  const modalFiltered = useMemo(() => {
    const q = modalSearch.trim().toLowerCase()
    if (!q) return modalFuncs
    // Marcações de relógio às vezes trazem o PIS com uma letra na frente
    // (ex.: "I01275464565") — busca pelos dígitos crus cobre isso sem o
    // usuário precisar "limpar" o valor antes de colar na busca.
    const qDigits = modalSearch.replace(/\D/g, '')
    return modalFuncs.filter((f) => {
      if (f.nome.toLowerCase().includes(q)) return true
      if (qDigits && ((f.cpf ?? '').includes(qDigits) || (f.pis ?? '').includes(qDigits))) return true
      return false
    })
  }, [modalFuncs, modalSearch])

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  const isSuporte = me?.suporte_sirrus === 1

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
          <h1 className={styles.title}>Marcações Pendentes de Vínculo</h1>
          <p className={styles.subtitle}>
            Marcações recebidas de um relógio de ponto cujo CPF/PIS ainda não corresponde a
            nenhum funcionário cadastrado. Vincule manualmente aqui, ou cadastre/corrija o
            funcionário com o mesmo CPF/PIS e clique em "Validar todos" — o vínculo é refeito
            automaticamente, sem precisar vincular uma por uma.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.btnAction} ${styles.btnPrimary}`}
          onClick={() => void handleValidarTodos()}
          disabled={validando}
        >
          {validando ? 'Validando…' : 'Validar todos'}
        </button>
      </div>

      <div className={styles.panelCard}>
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <select
              value={relogioFiltro}
              onChange={(e) => { setRelogioFiltro(e.target.value ? Number(e.target.value) : ''); setPagina(1) }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--sp-border)' }}
            >
              <option value="">Todos os relógios</option>
              {relogios.map((r) => (
                <option key={r.id} value={r.id}>{r.descricao}</option>
              ))}
            </select>
          </div>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Buscar por CPF ou PIS…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagina(1) }}
            />
          </div>
        </div>

        {error && <p className={`${styles.feedback} ${styles.feedbackError}`}>{error}</p>}
        {success && <p className={`${styles.feedback} ${styles.feedbackOk}`}>{success}</p>}

        <div className={styles.tableWrap}>
          {loading ? (
            <p className={styles.emptyTable}>Carregando…</p>
          ) : pendentes.length === 0 ? (
            <p className={styles.emptyTable}>Nenhuma marcação pendente de vínculo.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Relógio</th>
                  <th>CPF / PIS</th>
                  <th>Data/Hora da marcação</th>
                  <th>Recebida em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.tdMeta}>{item.relogio_descricao}</td>
                    <td>
                      <div className={styles.tdCode}>{cpfMask(item.cpf)}</div>
                      {item.pis && <div className={styles.tdCode}>{item.pis}</div>}
                    </td>
                    <td className={styles.tdMeta}>{formatDate(item.data_hora)}</td>
                    <td className={styles.tdMeta}>{formatDate(item.criado_em)}</td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className={`${styles.btnAction} ${styles.btnPrimary}`}
                        onClick={() => abrirVincular(item)}
                        disabled={excluindoId === item.id}
                      >
                        Vincular
                      </button>
                      {isSuporte && (
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => void handleExcluir(item)}
                          disabled={excluindoId === item.id}
                        >
                          {excluindoId === item.id ? 'Excluindo…' : 'Excluir'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0 0', flexWrap: 'wrap' }}>
            <span className={styles.tdMeta}>
              {total.toLocaleString('pt-BR')} marcação(ões) pendente(s) · página {pagina} de {totalPaginas}
            </span>
            <span style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className={styles.btnAction} disabled={pagina <= 1 || loading} onClick={() => setPagina((p) => p - 1)}>
                ← Anterior
              </button>
              <button type="button" className={styles.btnAction} disabled={pagina >= totalPaginas || loading} onClick={() => setPagina((p) => p + 1)}>
                Próxima →
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ── Modal de vínculo manual ── */}
      {vincularAlvo && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setVincularAlvo(null)}>
          <div className={styles.modal}>
            <div>
              <h3 className={styles.modalTitle}>Vincular marcação a um funcionário</h3>
              <p className={styles.modalSub}>
                {cpfMask(vincularAlvo.cpf)}{vincularAlvo.pis ? ` · PIS ${vincularAlvo.pis}` : ''} em{' '}
                {formatDate(vincularAlvo.data_hora)} — {vincularAlvo.relogio_descricao}
              </p>
            </div>

            <div className={styles.modalField}>
              <label>BUSCAR FUNCIONÁRIO</label>
              <input
                type="search"
                placeholder="Nome, CPF ou PIS…"
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
                const sel = modalSelected === f.id
                return (
                  <div
                    key={f.id}
                    className={`${styles.funcItem} ${sel ? styles.funcItemSelected : ''}`}
                    onClick={() => setModalSelected(f.id)}
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
                        {cpfMask(f.cpf)}{f.pis ? ` · PIS ${f.pis}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnCancel} onClick={() => setVincularAlvo(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btnAction} ${styles.btnPrimary}`}
                onClick={() => void confirmarVinculo()}
                disabled={modalSelected === null || modalSaving}
              >
                {modalSaving ? 'Vinculando…' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
