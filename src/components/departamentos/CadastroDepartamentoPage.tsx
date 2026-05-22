import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  createDepartamento,
  fetchDepartamentos,
  updateDepartamento,
  type CreateDepartamentoPayload,
  type Departamento,
  type UpdateDepartamentoPayload,
} from '../../services/cadastrosApi'
import styles from './CadastroDepartamentoPage.module.css'

function podeGerirDepartamentos(role: string | undefined) {
  return role === 'admin'
}

const emptyForm = () => ({
  nome: '',
  descricao: '',
  ativo: '1',
})

export function CadastroDepartamentoPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [lista, setLista] = useState<Departamento[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadLista = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoadingLista(true)
    return fetchDepartamentos()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => {
        if (!silent) setLoadingLista(false)
      })
  }, [])

  useEffect(() => {
    void loadLista()
  }, [loadLista])

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

  function iniciarEdicao(d: Departamento) {
    setEditingId(d.id)
    setForm({
      nome: d.nome,
      descricao: d.descricao ?? '',
      ativo: String(d.ativo ?? 1),
    })
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const nome = form.nome.trim()
    if (nome.length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
        const payload: UpdateDepartamentoPayload = {
          nome,
          descricao: form.descricao.trim() || null,
          ativo: form.ativo === '0' ? 0 : 1,
        }
        await updateDepartamento(editingId, payload)
        setSuccess('Departamento atualizado com sucesso.')
        cancelarEdicao()
      } else {
        const payload: CreateDepartamentoPayload = {
          nome,
          descricao: form.descricao.trim() || null,
        }
        await createDepartamento(payload)
        setSuccess('Departamento cadastrado com sucesso.')
        setForm(emptyForm())
      }
      await loadLista({ silent: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!meReady) {
    return <p className={styles.loading}>Carregando…</p>
  }

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p>Verifique a conexão com o servidor e se o token ainda é válido. Recarregue a página ou faça login de novo.</p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </p>
      </div>
    )
  }

  if (!podeGerirDepartamentos(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>
          Apenas administradores podem cadastrar departamentos. Se precisar de um novo departamento, fale com o
          administrador da empresa.
        </p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Departamentos</h1>
      <p className={styles.subtitle}>
        Cadastre e gerencie os departamentos da empresa. Departamentos podem ser vinculados a funcionários no cadastro.
      </p>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{editingId != null ? 'Editar departamento' : 'Novo departamento'}</h2>
        {editingId != null ? (
          <p className={styles.hint} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Alterando registro #{editingId}.{' '}
            <button type="button" className={styles.btnLink} onClick={cancelarEdicao}>
              Cancelar edição
            </button>
          </p>
        ) : null}

        {error ? (
          <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {success}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="dp-nome">Nome do departamento</label>
              <input
                id="dp-nome"
                name="nome"
                value={form.nome}
                onChange={update('nome')}
                autoComplete="off"
                required
              />
            </div>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="dp-desc">Descrição</label>
              <input
                id="dp-desc"
                name="descricao"
                value={form.descricao}
                onChange={update('descricao')}
                autoComplete="off"
              />
              <p className={styles.hint}>Opcional. Breve descrição das atividades do departamento.</p>
            </div>
            {editingId != null ? (
              <div className={styles.field}>
                <label htmlFor="dp-ativo">Situação</label>
                <select id="dp-ativo" name="ativo" value={form.ativo} onChange={update('ativo')}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </div>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            {editingId != null ? (
              <button type="button" className={styles.btnGhost} onClick={cancelarEdicao} disabled={submitting}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Departamentos cadastrados</h2>
        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <>
            <p className={styles.hint} style={{ marginBottom: '0.75rem' }}>
              A lista mostra apenas departamentos <strong>ativos</strong> (o servidor filtra os inativos). Ao desativar
              um departamento, ele deixa de aparecer aqui e nos selects de cadastro de funcionário.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Funcionários</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>Nenhum departamento cadastrado ainda.</td>
                    </tr>
                  ) : (
                    lista.map((d) => (
                      <tr key={d.id}>
                        <td>{d.nome}</td>
                        <td>{d.descricao ?? '—'}</td>
                        <td>{d.total_funcionarios ?? 0}</td>
                        <td>
                          {d.ativo === 0 ? (
                            <span className={`${styles.badge} ${styles.badgeOff}`}>Inativo</span>
                          ) : (
                            <span className={styles.badge}>Ativo</span>
                          )}
                        </td>
                        <td>
                          <button type="button" className={styles.btnLink} onClick={() => iniciarEdicao(d)}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
