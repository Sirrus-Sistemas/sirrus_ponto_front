import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  fetchMunicipios,
  createMunicipio,
  updateMunicipio,
  type Municipio,
} from '../../services/municipiosApi'
import styles from './CadastroMunicipioPage.module.css'

const PAGE_SIZE = 10

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

const FUSOS = ['UTC-02:00', 'UTC-03:00', 'UTC-04:00', 'UTC-05:00']

const emptyForm = () => ({
  CODMUNICIPIO: '',
  NOMEMUNICIPIO: '',
  ESTADO: 'AC',
  fuso_horario: 'UTC-03:00',
})

export function CadastroMunicipioPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista, setLista]             = useState<Municipio[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loadingLista, setLoadingLista] = useState(true)
  const [search, setSearch]           = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm]             = useState(emptyForm)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadLista = useCallback(
    (p: number, s: string, estado: string, silent = false) => {
      if (!silent) setLoadingLista(true)
      return fetchMunicipios({ search: s, estado, page: p, limit: PAGE_SIZE })
        .then((res) => { setLista(res.rows); setTotal(res.total) })
        .catch(() => { setLista([]); setTotal(0) })
        .finally(() => { if (!silent) setLoadingLista(false) })
    },
    []
  )

  useEffect(() => { void loadLista(page, search, estadoFiltro) }, [loadLista, page])

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    setPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => void loadLista(1, val, estadoFiltro), 400)
  }

  function handleEstadoChange(e: ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setEstadoFiltro(val)
    setPage(1)
    void loadLista(1, search, val)
  }

  const update =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  function cancelarEdicao() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  function iniciarEdicao(m: Municipio) {
    setEditingId(m.CODMUNICIPIO)
    setForm({
      CODMUNICIPIO: String(m.CODMUNICIPIO),
      NOMEMUNICIPIO: m.NOMEMUNICIPIO,
      ESTADO: m.ESTADO,
      fuso_horario: m.fuso_horario || 'UTC-03:00',
    })
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const nome   = form.NOMEMUNICIPIO.trim().toUpperCase()
    const estado = form.ESTADO.trim().toUpperCase()

    if (nome.length < 2)    { setError('Informe o nome do município (mín. 2 caracteres).'); return }
    if (estado.length !== 2) { setError('Informe a UF com 2 letras (ex: SP, RJ).'); return }

    setSubmitting(true)
    try {
      if (editingId != null) {
        await updateMunicipio(editingId, { NOMEMUNICIPIO: nome, ESTADO: estado, fuso_horario: form.fuso_horario })
        setSuccess('Município atualizado com sucesso.')
        cancelarEdicao()
      } else {
        const cod = parseInt(form.CODMUNICIPIO, 10)
        if (!cod || cod <= 0) { setError('Informe um código IBGE válido.'); setSubmitting(false); return }
        await createMunicipio({ CODMUNICIPIO: cod, NOMEMUNICIPIO: nome, ESTADO: estado, fuso_horario: form.fuso_horario })
        setSuccess('Município cadastrado com sucesso.')
        setForm(emptyForm())
      }
      await loadLista(page, search, estadoFiltro, true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p>Verifique a conexão e faça login novamente.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  if (me.role !== 'admin') {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores podem gerenciar municípios.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Localização">
        <span className={styles.breadcrumbItem}>Cadastro</span>
        <span className={styles.breadcrumbSep} aria-hidden>/</span>
        <span className={styles.breadcrumbCurrent}>Municípios</span>
      </nav>

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Municípios</h1>
        <p className={styles.subtitle}>
          Gerencie a tabela de municípios usada no cadastro de filiais e empresa.
        </p>
      </div>

      <div className={styles.grid}>
        {/* ── Formulário ── */}
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox}><PinIcon /></div>
            <div>
              <div className={styles.cardTitle}>
                {editingId != null ? 'Editar município' : 'Novo município'}
              </div>
              <div className={styles.cardDesc}>
                {editingId != null
                  ? <>Editando IBGE {editingId}. <button type="button" className={styles.btnCancel} onClick={cancelarEdicao}>Cancelar</button></>
                  : 'Disponível imediatamente nos cadastros.'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error   && <p className={styles.feedbackError} role="alert">{error}</p>}
            {success && <p className={styles.feedbackOk}   role="status">{success}</p>}

            {editingId == null && (
              <div className={styles.field}>
                <label htmlFor="mu-cod" className={styles.label}>Código IBGE</label>
                <input
                  id="mu-cod"
                  className={styles.input}
                  type="number"
                  value={form.CODMUNICIPIO}
                  onChange={update('CODMUNICIPIO')}
                  placeholder="ex: 3550308"
                  autoComplete="off"
                  required
                />
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="mu-nome" className={styles.label}>Nome do município</label>
              <input
                id="mu-nome"
                className={styles.input}
                value={form.NOMEMUNICIPIO}
                onChange={update('NOMEMUNICIPIO')}
                placeholder="ex: São Paulo"
                autoComplete="off"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="mu-uf" className={styles.label}>UF</label>
              <select id="mu-uf" className={styles.select} value={form.ESTADO} onChange={update('ESTADO')}>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="mu-fuso" className={styles.label}>Fuso horário</label>
              <select id="mu-fuso" className={styles.select} value={form.fuso_horario} onChange={update('fuso_horario')}>
                {FUSOS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {editingId == null && <PlusIcon />}
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </form>
        </div>

        {/* ── Tabela ── */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div className={styles.tableHeaderLeft}>
              <span className={styles.tableTitle}>Municípios cadastrados</span>
              <span className={styles.tableCount}>
                {loadingLista ? 'Carregando…' : `${lista.length} resultados nesta página`}
              </span>
            </div>
            <div className={styles.filters}>
              <div className={styles.searchWrap}>
                <SearchIcon />
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Buscar por nome ou código…"
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
              <select className={styles.filterSelect} value={estadoFiltro} onChange={handleEstadoChange}>
                <option value="">Todos os estados</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código IBGE</th>
                  <th>Nome</th>
                  <th>UF</th>
                  <th>Fuso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loadingLista ? (
                  <tr><td colSpan={5} className={styles.emptyCell}>Carregando…</td></tr>
                ) : lista.length === 0 ? (
                  <tr><td colSpan={5} className={styles.emptyCell}>Nenhum município encontrado.</td></tr>
                ) : (
                  lista.map((m) => (
                    <tr key={m.CODMUNICIPIO} className={styles.row}>
                      <td className={styles.tdCod}>{m.CODMUNICIPIO}</td>
                      <td className={styles.tdNome}>{m.NOMEMUNICIPIO}</td>
                      <td><span className={styles.ufChip}>{m.ESTADO}</span></td>
                      <td className={styles.tdFuso}>{m.fuso_horario}</td>
                      <td>
                        <button type="button" className={styles.btnEditar} onClick={() => iniciarEdicao(m)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <button className={styles.pgBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              ← Anterior
            </button>
            <span className={styles.pgInfo}>Página {page} de {totalPages} · {total} registros</span>
            <span className={styles.pgCount}>{lista.length} nesta página</span>
            <button className={styles.pgBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Próxima →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}
