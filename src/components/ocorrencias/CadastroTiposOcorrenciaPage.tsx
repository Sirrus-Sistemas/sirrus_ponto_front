import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
import styles from './Ocorrencias.module.css'

const emptyForm = () => ({
  descricao: '',
  tipo_lancamento: 'debito' as TipoLancamento,
})

export function CadastroTiposOcorrenciaPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [lista, setLista] = useState<TipoOcorrencia[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadLista = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingLista(true)
    return fetchTiposOcorrencia()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!opts?.silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

  function cancelarEdicao() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  function iniciarEdicao(t: TipoOcorrencia) {
    setEditingId(t.id)
    setForm({ descricao: t.descricao, tipo_lancamento: t.tipo_lancamento })
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.descricao.trim().length < 2) {
      setError('Informe uma descrição com pelo menos 2 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
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
        })
        setSuccess('Tipo de ocorrência cadastrado.')
        setForm(emptyForm())
      }
      await loadLista({ silent: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleAtivo(t: TipoOcorrencia) {
    try {
      await updateTipoOcorrencia(t.id, { ativo: t.ativo === 1 ? 0 : 1 })
      await loadLista({ silent: true })
    } catch {
      setError('Não foi possível alterar o status.')
    }
  }

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
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Tipos de Ocorrência</h1>
      <p className={styles.subtitle}>
        Cadastre os tipos de justificativa que podem ser lançados como ocorrências
        nos registros dos funcionários (atestados, abonos, licenças, etc.).
      </p>

      {/* ─── FORMULÁRIO ─────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          {editingId != null ? `Editando tipo #${editingId}` : 'Novo tipo de ocorrência'}
        </h2>
        {editingId != null ? (
          <p className={styles.hint} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            <button type="button" className={styles.btnLink} onClick={cancelarEdicao}>
              Cancelar edição
            </button>
          </p>
        ) : null}

        {error ? <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p> : null}
        {success ? <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{success}</p> : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="to-descricao">Descrição</label>
              <input
                id="to-descricao"
                autoComplete="off"
                placeholder="Ex: Atestado médico"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="to-tipo">Tipo de lançamento</label>
              <select
                id="to-tipo"
                value={form.tipo_lancamento}
                onChange={(e) => setForm((f) => ({ ...f, tipo_lancamento: e.target.value as TipoLancamento }))}
              >
                <option value="debito">Débito (desconto / falta)</option>
                <option value="credito">Crédito (abono / hora extra)</option>
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar tipo'}
            </button>
            {editingId != null ? (
              <button type="button" className={styles.btnGhost} onClick={cancelarEdicao} disabled={submitting}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {/* ─── LISTA ──────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Tipos cadastrados</h2>
        {loadingLista ? (
          <p className={styles.loading}>Carregando…</p>
        ) : (
          <div className={styles.tableWrap}>
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
                {lista.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={4}>Nenhum tipo cadastrado ainda.</td>
                  </tr>
                ) : (
                  lista.map((t) => (
                    <tr key={t.id}>
                      <td>{t.descricao}</td>
                      <td>
                        <span className={`${styles.badge} ${t.tipo_lancamento === 'credito' ? styles.badgeCredito : styles.badgeDebito}`}>
                          {t.tipo_lancamento === 'credito' ? 'Crédito' : 'Débito'}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${t.ativo === 0 ? '' : styles.badgeCredito}`}>
                          {t.ativo === 0 ? 'Inativo' : 'Ativo'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="button" className={styles.btnLink} onClick={() => iniciarEdicao(t)}>
                          Editar
                        </button>
                        <button type="button" className={styles.btnLink} onClick={() => void toggleAtivo(t)}>
                          {t.ativo === 1 ? 'Inativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
