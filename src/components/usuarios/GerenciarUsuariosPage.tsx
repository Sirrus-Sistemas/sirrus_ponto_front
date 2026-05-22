import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  fetchUsuarios,
  criarAcesso,
  atualizarAcesso,
  revogarAcesso,
  type UsuarioAcesso,
} from '../../services/usuariosApi'
import styles from './GerenciarUsuariosPage.module.css'

type Modo = 'criar' | 'editar' | null

const emptyNovoForm = () => ({ cpf: '', senha: '', confirmarSenha: '', role: 'funcionario' })
const emptyEditForm = () => ({ role: 'funcionario', nova_senha: '', confirmarSenha: '', cpf: '', ativo: '1' })

function roleBadge(role: string) {
  if (role === 'admin')      return <span className={`${styles.badge} ${styles.badgeRed}`}>Admin</span>
  if (role === 'gestor')     return <span className={`${styles.badge} ${styles.badgeBlue}`}>Gestor</span>
  return <span className={`${styles.badge} ${styles.badgeYellow}`}>Funcionário</span>
}

export function GerenciarUsuariosPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista, setLista] = useState<UsuarioAcesso[]>([])
  const [loadingLista, setLoadingLista] = useState(true)

  const [modo, setModo] = useState<Modo>(null)
  const [alvo, setAlvo] = useState<UsuarioAcesso | null>(null)

  const [novoForm, setNovoForm] = useState(emptyNovoForm)
  const [editForm, setEditForm] = useState(emptyEditForm)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadLista = useCallback((silent = false) => {
    if (!silent) setLoadingLista(true)
    return fetchUsuarios()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

  function abrirCriar(u: UsuarioAcesso) {
    setAlvo(u)
    setModo('criar')
    setNovoForm(emptyNovoForm())
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function abrirEditar(u: UsuarioAcesso) {
    setAlvo(u)
    setModo('editar')
    setEditForm({ role: u.role, nova_senha: '', confirmarSenha: '', cpf: u.cpf ?? '', ativo: String(u.usuario_ativo ?? 1) })
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function fechar() {
    setModo(null)
    setAlvo(null)
    setError(null)
  }

  const updateNovo =
    (field: keyof ReturnType<typeof emptyNovoForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setNovoForm((f) => ({ ...f, [field]: e.target.value }))

  const updateEdit =
    (field: keyof ReturnType<typeof emptyEditForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEditForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleCriar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const cpf = novoForm.cpf.replace(/\D/g, '')
    if (cpf.length !== 11) { setError('CPF deve ter 11 dígitos numéricos.'); return }
    if (novoForm.senha.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    if (novoForm.senha !== novoForm.confirmarSenha) { setError('As senhas não conferem.'); return }

    setSubmitting(true)
    try {
      await criarAcesso(alvo!.id, { cpf, senha: novoForm.senha, role: novoForm.role })
      setSuccess(`Acesso criado para ${alvo!.nome}.`)
      fechar()
      await loadLista(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o acesso.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const payload: Parameters<typeof atualizarAcesso>[1] = {}
    payload.role = editForm.role
    payload.ativo = editForm.ativo === '0' ? 0 : 1

    if (editForm.nova_senha) {
      if (editForm.nova_senha.length < 6) { setError('A nova senha deve ter no mínimo 6 caracteres.'); return }
      if (editForm.nova_senha !== editForm.confirmarSenha) { setError('As senhas não conferem.'); return }
      payload.nova_senha = editForm.nova_senha
    }

    if (editForm.cpf) {
      const cpf = editForm.cpf.replace(/\D/g, '')
      if (cpf.length !== 11) { setError('CPF deve ter 11 dígitos numéricos.'); return }
      payload.cpf = cpf
    }

    setSubmitting(true)
    try {
      await atualizarAcesso(alvo!.id, payload)
      setSuccess(`Acesso de ${alvo!.nome} atualizado.`)
      fechar()
      await loadLista(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o acesso.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevogar(u: UsuarioAcesso) {
    if (!confirm(`Revogar acesso de ${u.nome}? O funcionário não conseguirá mais fazer login.`)) return
    try {
      await revogarAcesso(u.id)
      setSuccess(`Acesso de ${u.nome} revogado.`)
      await loadLista(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível revogar o acesso.')
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
        <p>Apenas administradores podem gerenciar usuários do sistema.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Usuários do sistema</h1>
      <p className={styles.subtitle}>
        Defina quais funcionários podem acessar o sistema e qual é o nível de permissão de cada um.
        Roles: <strong>Admin</strong> vê e altera tudo · <strong>Gestor</strong> vê sua equipe · <strong>Funcionário</strong> acessa apenas seu próprio ponto.
      </p>

      {/* Painel de criação / edição */}
      {modo != null && alvo != null && (
        <div className={styles.card}>
          {error   && <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>}

          {modo === 'criar' && (
            <>
              <p className={styles.formHeader}>Conceder acesso a: <strong>{alvo.nome}</strong></p>
              <form onSubmit={handleCriar}>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label htmlFor="ua-cpf">CPF (somente números)</label>
                    <input
                      id="ua-cpf"
                      value={novoForm.cpf}
                      onChange={updateNovo('cpf')}
                      placeholder="00000000000"
                      maxLength={14}
                      required
                    />
                    <p className={styles.hint}>Usado como login. 11 dígitos sem pontos ou traço.</p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ua-role">Nível de acesso</label>
                    <select id="ua-role" value={novoForm.role} onChange={updateNovo('role')}>
                      <option value="funcionario">Funcionário</option>
                      <option value="gestor">Gestor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ua-senha">Senha inicial</label>
                    <input
                      id="ua-senha"
                      type="password"
                      value={novoForm.senha}
                      onChange={updateNovo('senha')}
                      autoComplete="new-password"
                      required
                    />
                    <p className={styles.hint}>Mínimo 6 caracteres.</p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ua-conf">Confirmar senha</label>
                    <input
                      id="ua-conf"
                      type="password"
                      value={novoForm.confirmarSenha}
                      onChange={updateNovo('confirmarSenha')}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                    {submitting ? 'Salvando…' : 'Conceder acesso'}
                  </button>
                  <button type="button" className={styles.btnGhost} onClick={fechar} disabled={submitting}>
                    Cancelar
                  </button>
                </div>
              </form>
            </>
          )}

          {modo === 'editar' && (
            <>
              <p className={styles.formHeader}>Editar acesso de: <strong>{alvo.nome}</strong></p>
              <form onSubmit={handleEditar}>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label htmlFor="ue-role">Nível de acesso</label>
                    <select id="ue-role" value={editForm.role} onChange={updateEdit('role')}>
                      <option value="funcionario">Funcionário</option>
                      <option value="gestor">Gestor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ue-ativo">Situação do acesso</label>
                    <select id="ue-ativo" value={editForm.ativo} onChange={updateEdit('ativo')}>
                      <option value="1">Ativo</option>
                      <option value="0">Bloqueado</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ue-cpf">CPF (login) — deixe em branco para não alterar</label>
                    <input
                      id="ue-cpf"
                      value={editForm.cpf}
                      onChange={updateEdit('cpf')}
                      placeholder="00000000000"
                      maxLength={14}
                    />
                  </div>
                  <div className={styles.field} />
                  <div className={styles.field}>
                    <label htmlFor="ue-senha">Nova senha — deixe em branco para não alterar</label>
                    <input
                      id="ue-senha"
                      type="password"
                      value={editForm.nova_senha}
                      onChange={updateEdit('nova_senha')}
                      autoComplete="new-password"
                    />
                    <p className={styles.hint}>Mínimo 6 caracteres, se preenchida.</p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ue-conf">Confirmar nova senha</label>
                    <input
                      id="ue-conf"
                      type="password"
                      value={editForm.confirmarSenha}
                      onChange={updateEdit('confirmarSenha')}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                    {submitting ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  <button type="button" className={styles.btnGhost} onClick={fechar} disabled={submitting}>
                    Cancelar
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Mensagem de sucesso fora do painel (após fechar) */}
      {success && modo == null && (
        <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{success}</p>
      )}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Funcionários e acessos</h2>

        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>E-mail</th>
                  <th>Acesso</th>
                  <th>Role</th>
                  <th>CPF (login)</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={7}>Nenhum funcionário encontrado.</td>
                  </tr>
                ) : (
                  lista.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nome}</td>
                      <td style={{ color: '#6b7280' }}>{u.email ?? '—'}</td>
                      <td>
                        {u.tem_acesso ? (
                          <span className={`${styles.badge} ${styles.badgeGreen}`}>Tem acesso</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeRed}`}>Sem acesso</span>
                        )}
                      </td>
                      <td>{u.tem_acesso ? roleBadge(u.role) : <span className={styles.badge}>—</span>}</td>
                      <td style={{ color: '#6b7280', fontFamily: 'monospace' }}>
                        {u.cpf ?? '—'}
                      </td>
                      <td>
                        {u.tem_acesso
                          ? u.usuario_ativo
                            ? <span className={`${styles.badge} ${styles.badgeGreen}`}>Ativo</span>
                            : <span className={`${styles.badge} ${styles.badgeRed}`}>Bloqueado</span>
                          : <span className={styles.badge}>—</span>
                        }
                      </td>
                      <td>
                        <div className={styles.tdActions}>
                          {!u.tem_acesso ? (
                            <button type="button" className={styles.btnLink} onClick={() => abrirCriar(u)}>
                              Conceder acesso
                            </button>
                          ) : (
                            <>
                              <button type="button" className={styles.btnLink} onClick={() => abrirEditar(u)}>
                                Editar
                              </button>
                              {u.usuario_ativo ? (
                                <>
                                  <span className={styles.separator}>·</span>
                                  <button type="button" className={styles.btnDanger} onClick={() => handleRevogar(u)}>
                                    Bloquear
                                  </button>
                                </>
                              ) : null}
                            </>
                          )}
                        </div>
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
