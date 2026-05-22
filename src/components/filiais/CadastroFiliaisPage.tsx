import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  createFilial,
  fetchFiliais,
  updateFilial,
  type CreateFilialPayload,
  type Filial,
  type UpdateFilialPayload,
} from '../../services/filiaisApi'
import styles from './CadastroFiliaisPage.module.css'

function podeGerirFiliais(role: string | undefined) {
  return role === 'admin'
}

const emptyForm = () => ({
  nome: '',
  tipo_documento: 'cnpj' as 'cnpj' | 'cpf',
  cnpj: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  telefone: '',
  email: '',
  num_registradora: '',
  ativa: '1',
})

function filialParaForm(f: Filial): ReturnType<typeof emptyForm> {
  return {
    nome: f.nome,
    tipo_documento: f.tipo_documento ?? 'cnpj',
    cnpj: f.cnpj ?? '',
    endereco: f.endereco ?? '',
    bairro: f.bairro ?? '',
    cidade: f.cidade ?? '',
    uf: f.uf ?? '',
    cep: f.cep ?? '',
    telefone: f.telefone ?? '',
    email: f.email ?? '',
    num_registradora: f.num_registradora ?? '',
    ativa: String(f.ativa ?? 1),
  }
}

export function CadastroFiliaisPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [lista, setLista] = useState<Filial[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadLista = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingLista(true)
    return fetchFiliais()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!opts?.silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

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

  function iniciarEdicao(f: Filial) {
    setEditingId(f.id)
    setForm(filialParaForm(f))
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.nome.trim().length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.')
      return
    }

    if (!form.email.trim()) {
      setError('O campo e-mail é obrigatório.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email.trim())) {
      setError('Informe um e-mail válido.')
      return
    }

    setSubmitting(true)
    try {
      const payload: CreateFilialPayload = {
        nome: form.nome.trim(),
        tipo_documento: form.tipo_documento,
        cnpj: form.cnpj.trim() || null,
        endereco: form.endereco.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        cep: form.cep.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        num_registradora: form.num_registradora.trim() || null,
      }

      if (editingId != null) {
        const upd: UpdateFilialPayload = { ...payload, ativa: form.ativa === '0' ? 0 : 1 }
        await updateFilial(editingId, upd)
        setSuccess('Filial atualizada com sucesso.')
        cancelarEdicao()
      } else {
        await createFilial(payload)
        setSuccess('Filial cadastrada com sucesso.')
        setForm(emptyForm())
      }
      await loadLista({ silent: true })
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
        <p>Verifique a conexão com o servidor e recarregue a página.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  if (!podeGerirFiliais(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores podem gerenciar filiais.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Cadastro de filiais</h1>
      <p className={styles.subtitle}>
        Gerencie as lojas ou unidades da empresa. Cada funcionário pode ser vinculado a uma filial,
        permitindo filtros e relatórios por unidade.
      </p>

      {/* ─── FORMULÁRIO ─────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          {editingId != null ? `Editando filial #${editingId}` : 'Nova filial'}
        </h2>
        {editingId != null ? (
          <p className={styles.hint} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            <button type="button" className={styles.btnLink} onClick={cancelarEdicao}>
              Cancelar edição
            </button>
          </p>
        ) : null}

        {error ? (
          <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>
        ) : null}
        {success ? (
          <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{success}</p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="fil-nome">Nome da filial</label>
              <input id="fil-nome" required autoComplete="off" value={form.nome} onChange={update('nome')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-tipo-doc">Tipo de documento</label>
              <select id="fil-tipo-doc" value={form.tipo_documento} onChange={update('tipo_documento')}>
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-cnpj">{form.tipo_documento === 'cpf' ? 'CPF' : 'CNPJ'}</label>
              <input id="fil-cnpj" value={form.cnpj} onChange={update('cnpj')} autoComplete="off" />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-tel">Telefone</label>
              <input id="fil-tel" value={form.telefone} onChange={update('telefone')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-registradora">Nº da registradora (relógio de ponto)</label>
              <input id="fil-registradora" value={form.num_registradora} onChange={update('num_registradora')} autoComplete="off" />
            </div>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="fil-email">E-mail</label>
              <input id="fil-email" type="email" value={form.email} onChange={update('email')} />
            </div>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="fil-end">Endereço</label>
              <input id="fil-end" value={form.endereco} onChange={update('endereco')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-bairro">Bairro</label>
              <input id="fil-bairro" value={form.bairro} onChange={update('bairro')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-cidade">Cidade</label>
              <input id="fil-cidade" value={form.cidade} onChange={update('cidade')} />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-uf">UF</label>
              <input id="fil-uf" maxLength={2} value={form.uf} onChange={update('uf')} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className={styles.field}>
              <label htmlFor="fil-cep">CEP</label>
              <input id="fil-cep" value={form.cep} onChange={update('cep')} />
            </div>
            {editingId != null ? (
              <div className={styles.field}>
                <label htmlFor="fil-ativa">Situação</label>
                <select id="fil-ativa" value={form.ativa} onChange={update('ativa')}>
                  <option value="1">Ativa</option>
                  <option value="0">Inativa</option>
                </select>
              </div>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar filial'}
            </button>
            {editingId != null ? (
              <button type="button" className={styles.btnGhost} onClick={cancelarEdicao} disabled={submitting}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {/* ─── LISTA ──────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Filiais cadastradas</h2>
        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cidade / UF</th>
                  <th>CNPJ</th>
                  <th>Telefone</th>
                  <th>Colaboradores</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={7}>Nenhuma filial cadastrada ainda.</td>
                  </tr>
                ) : (
                  lista.map((f) => (
                    <tr key={f.id}>
                      <td>{f.nome}</td>
                      <td>{[f.cidade, f.uf].filter(Boolean).join(' / ') || '—'}</td>
                      <td>{f.cnpj || '—'}</td>
                      <td>{f.telefone || '—'}</td>
                      <td>{f.total_funcionarios ?? 0}</td>
                      <td>
                        {f.ativa === 0
                          ? <span className={`${styles.badge} ${styles.badgeOff}`}>Inativa</span>
                          : <span className={styles.badge}>Ativa</span>
                        }
                      </td>
                      <td>
                        <button type="button" className={styles.btnLink} onClick={() => iniciarEdicao(f)}>
                          Editar
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
