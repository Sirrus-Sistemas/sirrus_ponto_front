import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  createTipoOcorrencia,
  fetchTiposOcorrencia,
  updateTipoOcorrencia,
  type TipoLancamento,
  type TipoOcorrencia,
} from '../../services/ocorrenciasApi'
import styles from './TiposOcorrenciaPage.module.css'

// ── helpers ───────────────────────────────────────────────────────────────────

function normalizeName(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function todayBR() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ── icon strategy ─────────────────────────────────────────────────────────────

type IconInfo = { Icon: () => ReactElement; bg: string }

function getIconInfo(descricao: string, tipo: TipoLancamento): IconInfo {
  const d = descricao.toLowerCase()
  if (/atestado|licen[çc]|afastamento|inss|maternidade|paternidade|m[eé]dico/.test(d))
    return { Icon: CrossIcon,    bg: styles.iconMedical }
  if (/banco\s*(de\s*)?hora/.test(d))
    return { Icon: BankIcon,     bg: styles.iconBank }
  if (/falta/.test(d))
    return { Icon: WarnTriangle, bg: styles.iconWarn }
  if (/f[eé]r[ia]|folga|dsr|descanso|repouso/.test(d))
    return { Icon: SunIcon,      bg: styles.iconVacation }
  if (/sem\s*registro/.test(d))
    return { Icon: DashIcon,     bg: styles.iconNeutral }
  return tipo === 'credito'
    ? { Icon: ArrowUpIcon,   bg: styles.iconCredito }
    : { Icon: ArrowDownIcon, bg: styles.iconDebito }
}

// ── form ──────────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  descricao: '',
  tipo_lancamento: 'credito' as TipoLancamento,
  ativoAoCriar: true,
})

// ── component ─────────────────────────────────────────────────────────────────

export function CadastroTiposOcorrenciaPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista,       setLista]       = useState<TipoOcorrencia[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [search,      setSearch]      = useState('')
  const [form,        setForm]        = useState(emptyForm)
  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  const tableRef = useRef<HTMLDivElement>(null)
  const isEditing = editingId != null

  const loadLista = useCallback((silent = false) => {
    if (!silent) setLoadingLista(true)
    return fetchTiposOcorrencia()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

  // ── duplicate detection ──────────────────────────────────────────────────

  const dupGroups = useMemo(() => {
    const map = new Map<string, TipoOcorrencia[]>()
    lista.forEach(t => {
      const k = normalizeName(t.descricao)
      map.set(k, [...(map.get(k) ?? []), t])
    })
    const result = new Map<string, TipoOcorrencia[]>()
    map.forEach((items, key) => { if (items.length > 1) result.set(key, items) })
    return result
  }, [lista])

  const isDup = (t: TipoOcorrencia) => dupGroups.has(normalizeName(t.descricao))

  const firstDupPair = useMemo(() => {
    for (const items of dupGroups.values()) return items
    return null
  }, [dupGroups])

  // ── table filter ──────────────────────────────────────────────────────────

  const listaFiltrada = useMemo(() =>
    lista.filter(t => t.descricao.toLowerCase().includes(search.toLowerCase())),
    [lista, search]
  )

  // ── actions ───────────────────────────────────────────────────────────────

  function cancelarEdicao() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  function iniciarEdicao(t: TipoOcorrencia) {
    setEditingId(t.id)
    setForm({ descricao: t.descricao, tipo_lancamento: t.tipo_lancamento, ativoAoCriar: t.ativo === 1 })
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.descricao.trim().length < 2) {
      setError('Informe uma descrição com pelo menos 2 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      if (isEditing) {
        await updateTipoOcorrencia(editingId, {
          descricao: form.descricao.trim(),
          tipo_lancamento: form.tipo_lancamento,
        })
        setSuccess('Tipo de ocorrência atualizado.')
        cancelarEdicao()
      } else {
        await createTipoOcorrencia({
          descricao: form.descricao.trim(),
          tipo_lancamento: form.tipo_lancamento,
          ativo: form.ativoAoCriar ? 1 : 0,
        })
        setSuccess('Tipo de ocorrência cadastrado.')
        setForm(emptyForm())
      }
      await loadLista(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleAtivo(t: TipoOcorrencia) {
    try {
      await updateTipoOcorrencia(t.id, { ativo: t.ativo === 1 ? 0 : 1 })
      await loadLista(true)
    } catch {
      setError('Não foi possível alterar o status.')
    }
  }

  // ── guards ────────────────────────────────────────────────────────────────

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  if (me.role !== 'admin') {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores podem gerenciar tipos de ocorrência.</p>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  const launchedBy = me.nome?.split(' ')[0] ?? 'RH'
  const previewName = form.descricao.trim() || '—'

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <span className={styles.breadcrumbItem}>Cadastro</span>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>Tipos de Ocorrência</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Tipos de Ocorrência</h1>
          <p className={styles.subtitle}>Monte o tipo e veja como ele aparece no lançamento antes de salvar.</p>
        </div>
      </div>

      <div className={styles.grid}>

        {/* ── LEFT: form card ── */}
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIconBox}><PlusIcon /></div>
            <div className={styles.cardHeaderText}>
              <div className={styles.cardTitle}>{isEditing ? 'Editando tipo' : 'Novo tipo'}</div>
              <div className={styles.cardDesc}>
                {isEditing
                  ? <><span>Alterações salvas imediatamente. </span><button type="button" className={styles.btnCancelar} onClick={cancelarEdicao}>Cancelar</button></>
                  : 'Descrição e impacto na conta de horas.'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {error   && <p className={styles.feedbackError} role="alert">{error}</p>}
            {success && <p className={styles.feedbackOk}    role="status">{success}</p>}

            {/* DESCRIÇÃO */}
            <div className={styles.field}>
              <label htmlFor="to-desc" className={styles.label}>Descrição</label>
              <input
                id="to-desc"
                className={styles.input}
                autoComplete="off"
                placeholder="Ex: Atestado médico"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            {/* TIPO DE LANÇAMENTO */}
            <div className={styles.field}>
              <span className={styles.label}>Tipo de lançamento</span>
              <div className={styles.tipoRow}>
                <button
                  type="button"
                  className={`${styles.tipoBtn} ${form.tipo_lancamento === 'credito' ? styles.tipoBtnCredito : ''}`}
                  onClick={() => setForm(f => ({ ...f, tipo_lancamento: 'credito' }))}
                >
                  <span className={styles.tipoBtnArrow}><ArrowUpIcon /></span>
                  <span className={styles.tipoBtnText}>
                    <span className={styles.tipoBtnName}>Crédito</span>
                    <span className={styles.tipoBtnSub}>soma / abona horas</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.tipoBtn} ${form.tipo_lancamento === 'debito' ? styles.tipoBtnDebito : ''}`}
                  onClick={() => setForm(f => ({ ...f, tipo_lancamento: 'debito' }))}
                >
                  <span className={styles.tipoBtnArrow}><ArrowDownIcon /></span>
                  <span className={styles.tipoBtnText}>
                    <span className={styles.tipoBtnName}>Débito</span>
                    <span className={styles.tipoBtnSub}>desconta / falta</span>
                  </span>
                </button>
              </div>
            </div>

            {/* ATIVO AO CRIAR */}
            {!isEditing && (
              <label className={`${styles.toggleRow} ${form.ativoAoCriar ? styles.toggleRowOn : ''}`}>
                <div className={styles.toggleRowText}>
                  <span className={styles.toggleRowLabel}>Ativo ao criar</span>
                  <span className={styles.toggleRowDesc}>Disponível para lançamento imediatamente.</span>
                </div>
                <div
                  className={`${styles.toggle} ${form.ativoAoCriar ? styles.toggleOn : ''}`}
                  onClick={e => { e.preventDefault(); setForm(f => ({ ...f, ativoAoCriar: !f.ativoAoCriar })) }}
                >
                  <div className={styles.toggleThumb} />
                </div>
              </label>
            )}

            {/* PREVIEW */}
            <div className={styles.previewSection}>
              <span className={styles.previewLabel}>Pré-visualização no lançamento</span>
              <div className={styles.previewCard}>
                <div className={styles.previewIconBox}><DocIcon /></div>
                <div className={styles.previewInfo}>
                  <span className={styles.previewName}>{previewName}</span>
                  <span className={styles.previewMeta}>{todayBR()} · lançado por {launchedBy}</span>
                </div>
                <span className={`${styles.tipoBadge} ${form.tipo_lancamento === 'credito' ? styles.tipoBadgeCredito : styles.tipoBadgeDebito}`}>
                  {form.tipo_lancamento === 'credito' ? '↑ Crédito' : '↓ Débito'}
                </span>
              </div>
            </div>

            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : '+ Cadastrar tipo'}
            </button>
          </form>
        </div>

        {/* ── RIGHT: table card ── */}
        <div className={styles.tableCard} ref={tableRef}>
          <div className={styles.tableTop}>
            <div>
              <div className={styles.tableTitle}>Tipos cadastrados</div>
              <div className={styles.tableCount}>
                {loadingLista ? '…' : `${listaFiltrada.length} de ${lista.length}`}
              </div>
            </div>
            <div className={styles.searchWrap}>
              <SearchIcon />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Duplicate banner */}
          {dupGroups.size > 0 && firstDupPair && (
            <div className={styles.dupBanner}>
              <span className={styles.dupBannerIcon}><WarnCircleIcon /></span>
              <span className={styles.dupBannerText}>
                <strong>{dupGroups.size} {dupGroups.size === 1 ? 'possível duplicidade.' : 'possíveis duplicidades.'}</strong>
                {' '}"{firstDupPair[0].descricao}" e "{firstDupPair[1].descricao}" têm o mesmo nome. Unifique para evitar lançamentos divididos.
              </span>
              <button
                type="button"
                className={styles.btnRevisar}
                onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                Revisar
              </button>
            </div>
          )}

          <div className={styles.tableWrap}>
            {loadingLista ? (
              <p className={styles.loading}>Carregando…</p>
            ) : listaFiltrada.length === 0 ? (
              <p className={styles.tableEmpty}>
                {search ? 'Nenhum tipo encontrado para essa busca.' : 'Nenhum tipo cadastrado ainda.'}
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map(t => {
                    const { Icon, bg } = getIconInfo(t.descricao, t.tipo_lancamento)
                    const dup = isDup(t)
                    return (
                      <tr key={t.id} className={dup ? styles.rowDup : ''}>
                        <td>
                          <div className={styles.descCell}>
                            <div className={`${styles.rowIcon} ${bg}`}><Icon /></div>
                            <span className={styles.rowName}>{t.descricao}</span>
                            {dup && <span className={styles.badgeDup}>DUPLICADO</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.tipoBadge} ${t.tipo_lancamento === 'credito' ? styles.tipoBadgeCredito : styles.tipoBadgeDebito}`}>
                            {t.tipo_lancamento === 'credito' ? '↑ Crédito' : '↓ Débito'}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.statusDot} ${t.ativo === 1 ? styles.statusAtivo : styles.statusInativo}`}>
                            ● {t.ativo === 1 ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <button type="button" className={styles.btnEditar} onClick={() => iniciarEdicao(t)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`${styles.toggle} ${t.ativo === 1 ? styles.toggleOn : ''}`}
                              onClick={() => void toggleAtivo(t)}
                              aria-label={t.ativo === 1 ? 'Desativar' : 'Ativar'}
                            >
                              <div className={styles.toggleThumb} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
}
function ArrowUpIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
}
function ArrowDownIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
}
function DocIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function CrossIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
}
function BankIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
}
function WarnTriangle() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function SunIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function DashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
}
function WarnCircleIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
