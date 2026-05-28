import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  fetchFeriados,
  createFeriado,
  updateFeriado,
  deleteFeriado,
  type Feriado,
  type TipoFeriado,
} from '../../services/feriadosApi'
import styles from './CadastroFeriadosPage.module.css'

const PAGE_SIZE = 20

const TIPOS: { value: TipoFeriado; label: string }[] = [
  { value: 'nacional',    label: 'Nacional' },
  { value: 'estadual',    label: 'Estadual' },
  { value: 'municipal',   label: 'Municipal' },
  { value: 'empresa', label: 'Empresarial' },
]

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 10 }, (_, i) => ANO_ATUAL - 2 + i)

const emptyForm = () => ({
  nome: '',
  data: '',
  tipo: 'nacional' as TipoFeriado,
  recorrente: true,
  uf: '',
  observacao: '',
})

function badgeClass(tipo: TipoFeriado): string {
  const map: Record<TipoFeriado, string> = {
    nacional:    styles.badgeNacional,
    estadual:    styles.badgeEstadual,
    municipal:   styles.badgeMunicipal,
    empresa: styles.badgeEmpresarial,
  }
  return `${styles.badge} ${map[tipo]}`
}

function formatarData(data: string, recorrente: boolean): string {
  if (!data) return '—'
  if (recorrente) {
    // formato MM-DD
    const partes = data.split('-')
    if (partes.length >= 2) {
      const mes = partes[partes.length - 2].padStart(2, '0')
      const dia = partes[partes.length - 1].padStart(2, '0')
      return `${dia}/${mes} (todo ano)`
    }
    return data
  }
  // formato YYYY-MM-DD
  const [y, m, d] = data.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return data
}

export function CadastroFeriadosPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  // ── Lista ──────────────────────────────────────────────────────────────────
  const [lista, setLista]           = useState<Feriado[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loadingLista, setLoading]  = useState(true)
  const [listaError, setListaError] = useState<string | null>(null)

  const [search, setSearch]         = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [anoFiltro, setAnoFiltro]   = useState<string>(String(ANO_ATUAL))
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Formulário ─────────────────────────────────────────────────────────────
  const [form, setForm]           = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Exclusão ───────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Feriado | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── Carregar lista ─────────────────────────────────────────────────────────
  const loadLista = useCallback(
    (p: number, s: string, tipo: string, ano: string, silent = false) => {
      if (!silent) setLoading(true)
      setListaError(null)
      return fetchFeriados({ search: s, tipo: tipo || undefined, ano: ano || undefined, page: p, limit: PAGE_SIZE })
        .then((res) => { setLista(res.rows); setTotal(res.total) })
        .catch((err: unknown) => {
          setLista([])
          setTotal(0)
          setListaError(err instanceof ApiError ? err.message : 'Não foi possível carregar os feriados. Verifique a conexão com o servidor.')
        })
        .finally(() => { if (!silent) setLoading(false) })
    },
    []
  )

  useEffect(() => {
    void loadLista(page, search, tipoFiltro, anoFiltro)
  }, [loadLista, page])

  // ── Handlers filtros ───────────────────────────────────────────────────────
  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    setPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => void loadLista(1, val, tipoFiltro, anoFiltro), 400)
  }

  function handleTipoFiltro(e: ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setTipoFiltro(val)
    setPage(1)
    void loadLista(1, search, val, anoFiltro)
  }

  function handleAnoFiltro(e: ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setAnoFiltro(val)
    setPage(1)
    void loadLista(1, search, tipoFiltro, val)
  }

  // ── Handlers form ──────────────────────────────────────────────────────────
  const update =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }

  function handleRecorrente(e: ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, recorrente: e.target.checked, data: '' }))
  }

  function cancelarEdicao() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  function iniciarEdicao(f: Feriado) {
    setEditingId(f.id)
    setForm({
      nome:       f.nome,
      data:       f.data,
      tipo:       f.tipo,
      recorrente: f.recorrente,
      uf:         f.uf ?? '',
      observacao: f.observacao ?? '',
    })
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const nome = form.nome.trim()
    if (nome.length < 2) { setError('Informe o nome do feriado (mín. 2 caracteres).'); return }
    if (!form.data)       { setError('Informe a data do feriado.'); return }
    if (form.tipo === 'estadual' && !form.uf) {
      setError('Informe a UF para feriados estaduais.')
      return
    }

    const payload = {
      nome,
      data:       form.data,
      tipo:       form.tipo,
      recorrente: form.recorrente,
      uf:         form.tipo === 'estadual' ? form.uf || null : null,
      observacao: form.observacao.trim() || null,
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
        await updateFeriado(editingId, payload)
        cancelarEdicao()
        showToast('Feriado atualizado com sucesso.')
      } else {
        await createFeriado(payload)
        setForm(emptyForm())
        showToast('Feriado cadastrado com sucesso.')
      }
      await loadLista(page, search, tipoFiltro, anoFiltro, true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o feriado.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Exclusão ───────────────────────────────────────────────────────────────
  async function confirmarExclusao() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteFeriado(deleteTarget.id)
      setSuccess(`Feriado "${deleteTarget.nome}" removido com sucesso.`)
      setDeleteTarget(null)
      await loadLista(page, search, tipoFiltro, anoFiltro, true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o feriado.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function showToast(msg: string) {
    if (successTimer.current) clearTimeout(successTimer.current)
    setSuccess(msg)
    successTimer.current = setTimeout(() => setSuccess(null), 5000)
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
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
        <p>Apenas administradores podem gerenciar feriados.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {success && (
        <div role="status" style={{
          position: 'fixed', top: 16, right: 16, zIndex: 3000,
          padding: '0.65rem 1.1rem', borderRadius: 10,
          background: '#ecfdf5', color: '#065f46',
          fontWeight: 600, fontSize: '0.88rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {success}
        </div>
      )}
      <h1 className={styles.title}>Feriados</h1>
      <p className={styles.subtitle}>
        Cadastre feriados nacionais, estaduais, municipais e empresariais utilizados no cálculo de escalas e jornadas.
      </p>

      {/* ── Formulário ─────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          {editingId != null ? 'Editar feriado' : 'Novo feriado'}
        </h2>

        {editingId != null && (
          <p className={styles.hint} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Editando feriado #{editingId}.{' '}
            <button type="button" className={styles.btnLink} onClick={cancelarEdicao}>
              Cancelar edição
            </button>
          </p>
        )}

        {error && <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className={`${styles.grid} ${styles.gridThree}`}>
            {/* Nome */}
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="fer-nome">Nome do feriado</label>
              <input
                id="fer-nome"
                value={form.nome}
                onChange={update('nome')}
                placeholder="ex: Natal, Tiradentes, Aniversário da cidade…"
                autoComplete="off"
                required
              />
            </div>

            {/* Tipo */}
            <div className={styles.field}>
              <label htmlFor="fer-tipo">Tipo</label>
              <select id="fer-tipo" value={form.tipo} onChange={update('tipo')}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* UF — só para estadual */}
            {form.tipo === 'estadual' ? (
              <div className={styles.field}>
                <label htmlFor="fer-uf">UF</label>
                <select id="fer-uf" value={form.uf} onChange={update('uf')} required>
                  <option value="">Selecione…</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            ) : (
              <div /> /* placeholder para manter o grid */
            )}

            {/* Data */}
            <div className={styles.field}>
              <label htmlFor="fer-data">
                {form.recorrente ? 'Data (dia/mês)' : 'Data'}
              </label>
              <input
                id="fer-data"
                type={form.recorrente ? 'text' : 'date'}
                value={form.data}
                onChange={update('data')}
                placeholder={form.recorrente ? 'ex: 12-25 (mês-dia)' : ''}
                pattern={form.recorrente ? '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' : undefined}
                title={form.recorrente ? 'Formato MM-DD, ex: 12-25 para 25 de dezembro' : undefined}
                required
              />
              {form.recorrente && (
                <span className={styles.hint}>Formato MM-DD, ex: 12-25 para 25 de dezembro</span>
              )}
            </div>

            {/* Recorrente */}
            <div className={styles.field} style={{ justifyContent: 'flex-end', paddingBottom: '0.15rem' }}>
              <label>Recorrência</label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={handleRecorrente}
                />
                <span className={styles.toggleLabel}>Repete todo ano</span>
              </label>
            </div>

            {/* Observação */}
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="fer-obs">Observação (opcional)</label>
              <textarea
                id="fer-obs"
                value={form.observacao}
                onChange={update('observacao')}
                placeholder="Informações adicionais sobre o feriado…"
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar feriado'}
            </button>
            {editingId != null && (
              <button type="button" className={styles.btnGhost} onClick={cancelarEdicao} disabled={submitting}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Feriados cadastrados</h2>

        <div className={styles.filters}>
          <input
            type="search"
            placeholder="Buscar por nome…"
            value={search}
            onChange={handleSearchChange}
          />
          <select value={tipoFiltro} onChange={handleTipoFiltro}>
            <option value="">Todos os tipos</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select value={anoFiltro} onChange={handleAnoFiltro}>
            <option value="">Todos os anos</option>
            {ANOS.map((a) => (
              <option key={a} value={String(a)}>{a}</option>
            ))}
          </select>
        </div>

        {listaError && (
          <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{listaError}</p>
        )}
        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>UF</th>
                    <th>Recorrente</th>
                    <th>Observação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={7}>Nenhum feriado encontrado.</td>
                    </tr>
                  ) : (
                    lista.map((f) => (
                      <tr key={f.id}>
                        <td><strong>{f.nome}</strong></td>
                        <td>{formatarData(f.data, f.recorrente)}</td>
                        <td>
                          <span className={badgeClass(f.tipo)}>
                            {TIPOS.find((t) => t.value === f.tipo)?.label ?? f.tipo}
                          </span>
                        </td>
                        <td>{f.uf ?? '—'}</td>
                        <td>
                          <span className={styles.recorrenteIcon} title={f.recorrente ? 'Repete todo ano' : 'Data fixa'}>
                            {f.recorrente ? '🔁' : '📅'}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.observacao || '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                              type="button"
                              className={styles.btnLink}
                              onClick={() => iniciarEdicao(f)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={styles.btnDanger}
                              onClick={() => setDeleteTarget(f)}
                            >
                              Excluir
                            </button>
                          </div>
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

      {/* ── Modal de confirmação de exclusão ───────────────────────────── */}
      {deleteTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3>Confirmar exclusão</h3>
            <p>
              Tem certeza que deseja excluir o feriado{' '}
              <strong>"{deleteTarget.nome}"</strong>?
              Essa ação não pode ser desfeita.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnDeleteConfirm}
                onClick={() => void confirmarExclusao()}
                disabled={deleting}
              >
                {deleting ? 'Excluindo…' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
