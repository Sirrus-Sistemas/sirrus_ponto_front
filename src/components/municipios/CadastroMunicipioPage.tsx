import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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

const PAGE_SIZE = 20

const FUSOS = [
  'UTC-02:00', 'UTC-03:00', 'UTC-04:00', 'UTC-05:00',
]

const emptyForm = () => ({
  CODMUNICIPIO: '',
  NOMEMUNICIPIO: '',
  ESTADO: '',
  fuso_horario: 'UTC-03:00',
})

export function CadastroMunicipioPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista, setLista] = useState<Municipio[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingLista, setLoadingLista] = useState(true)

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadLista = useCallback(
    (p: number, s: string, estado: string, silent = false) => {
      if (!silent) setLoadingLista(true)
      return fetchMunicipios({ search: s, estado, page: p, limit: PAGE_SIZE })
        .then((res) => {
          setLista(res.rows)
          setTotal(res.total)
        })
        .catch(() => { setLista([]); setTotal(0) })
        .finally(() => { if (!silent) setLoadingLista(false) })
    },
    []
  )

  useEffect(() => {
    void loadLista(page, search, estadoFiltro)
  }, [loadLista, page])

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    setPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void loadLista(1, val, estadoFiltro)
    }, 400)
  }

  function handleEstadoChange(e: ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setEstadoFiltro(val)
    setPage(1)
    void loadLista(1, search, val)
  }

  const update =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const nome = form.NOMEMUNICIPIO.trim().toUpperCase()
    const estado = form.ESTADO.trim().toUpperCase()

    if (nome.length < 2) { setError('Informe o nome do município (mín. 2 caracteres).'); return }
    if (estado.length !== 2) { setError('Informe a UF com 2 letras (ex: SP, RJ).'); return }

    setSubmitting(true)
    try {
      if (editingId != null) {
        await updateMunicipio(editingId, {
          NOMEMUNICIPIO: nome,
          ESTADO: estado,
          fuso_horario: form.fuso_horario,
        })
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
      <h1 className={styles.title}>Municípios</h1>
      <p className={styles.subtitle}>
        Gerencie a tabela de municípios usada no cadastro de filiais e empresa.
      </p>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{editingId != null ? 'Editar município' : 'Novo município'}</h2>

        {editingId != null && (
          <p className={styles.hint} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Editando código IBGE {editingId}.{' '}
            <button type="button" className={styles.btnLink} onClick={cancelarEdicao}>Cancelar edição</button>
          </p>
        )}

        {error   && <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>}
        {success && <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className={styles.grid}>
            {editingId == null && (
              <div className={styles.field}>
                <label htmlFor="mu-cod">Código IBGE</label>
                <input
                  id="mu-cod"
                  type="number"
                  value={form.CODMUNICIPIO}
                  onChange={update('CODMUNICIPIO')}
                  placeholder="ex: 3550308"
                  required
                />
              </div>
            )}
            <div className={`${styles.field} ${editingId == null ? '' : styles.gridFull}`}>
              <label htmlFor="mu-nome">Nome do município</label>
              <input
                id="mu-nome"
                value={form.NOMEMUNICIPIO}
                onChange={update('NOMEMUNICIPIO')}
                autoComplete="off"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="mu-uf">UF</label>
              <input
                id="mu-uf"
                value={form.ESTADO}
                onChange={update('ESTADO')}
                maxLength={2}
                placeholder="SP"
                style={{ textTransform: 'uppercase' }}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="mu-fuso">Fuso horário</label>
              <select id="mu-fuso" value={form.fuso_horario} onChange={update('fuso_horario')}>
                {FUSOS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            {editingId != null && (
              <button type="button" className={styles.btnGhost} onClick={cancelarEdicao} disabled={submitting}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Municípios cadastrados</h2>

        <div className={styles.filters}>
          <input
            type="search"
            placeholder="Buscar por nome…"
            value={search}
            onChange={handleSearchChange}
          />
          <select value={estadoFiltro} onChange={handleEstadoChange}>
            <option value="">Todos os estados</option>
            {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(
              (uf) => <option key={uf} value={uf}>{uf}</option>
            )}
          </select>
        </div>

        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <>
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
                  {lista.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>Nenhum município encontrado.</td>
                    </tr>
                  ) : (
                    lista.map((m) => (
                      <tr key={m.CODMUNICIPIO}>
                        <td>{m.CODMUNICIPIO}</td>
                        <td>{m.NOMEMUNICIPIO}</td>
                        <td>{m.ESTADO}</td>
                        <td>{m.fuso_horario}</td>
                        <td>
                          <button type="button" className={styles.btnLink} onClick={() => iniciarEdicao(m)}>
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
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>← Anterior</button>
              <span>Página {page} de {totalPages} · {total} registros</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Próxima →</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
