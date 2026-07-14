import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchFiliais, type Filial } from '../../services/filiaisApi'
import {
  fetchRelogios,
  createRelogio,
  updateRelogio,
  deleteRelogio,
  MODELOS_RELOGIO,
  type Relogio,
  type ModeloRelogio,
} from '../../services/relogiosApi'
import styles from './CadastroRelogiosPage.module.css'

function canManage(role: string | undefined) {
  return role === 'admin'
}

function modeloInfo(value: string) {
  return MODELOS_RELOGIO.find((m) => m.value === value)
}

type FormState = {
  numero_serie: string
  descricao: string
  modelo: ModeloRelogio
  ip: string
  porta: string
  usuario: string
  senha: string
  usa_afd: boolean
  filial_id: string
  ativo: boolean
  sincronizar_desde: string
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = (): FormState => ({
  numero_serie: '',
  descricao: '',
  modelo: 'control_id',
  ip: '',
  porta: '80',
  usuario: '',
  senha: '',
  usa_afd: false,
  filial_id: '',
  ativo: true,
  sincronizar_desde: hoje(),
})

export function CadastroRelogiosPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista, setLista] = useState<Relogio[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [filiais, setFiliais] = useState<Filial[]>([])

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const loadLista = useCallback(async (silent = false) => {
    if (!silent) setLoadingLista(true)
    try {
      setLista(await fetchRelogios())
    } catch {
      setLista([])
    } finally {
      if (!silent) setLoadingLista(false)
    }
  }, [])

  useEffect(() => {
    void loadLista()
    fetchFiliais().then(setFiliais).catch(() => {})
  }, [loadLista])

  // Quando o modelo muda, ajusta usa_afd automaticamente
  useEffect(() => {
    const info = modeloInfo(form.modelo)
    if (info) {
      setForm((f) => ({ ...f, usa_afd: info.afd }))
    }
  }, [form.modelo])

  const update =
    (field: keyof Omit<FormState, 'usa_afd' | 'ativo'>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  function startCreating() {
    setEditingId(null)
    setForm(emptyForm())
    setPanelOpen(true)
    setError(null)
    setSuccess(null)
  }

  function iniciarEdicao(r: Relogio) {
    setEditingId(r.id)
    setPanelOpen(true)
    setForm({
      numero_serie: r.numero_serie,
      descricao: r.descricao,
      modelo: r.modelo,
      ip: r.ip ?? '',
      porta: r.porta != null ? String(r.porta) : '80',
      usuario: r.usuario ?? '',
      senha: r.senha ?? '',
      usa_afd: r.usa_afd,
      filial_id: r.filial_id != null ? String(r.filial_id) : '',
      ativo: r.ativo,
      sincronizar_desde: r.sincronizar_desde ? r.sincronizar_desde.slice(0, 10) : hoje(),
    })
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.numero_serie.trim()) { setError('Informe o número de série.'); return }
    if (!form.descricao.trim())   { setError('Informe uma descrição para o equipamento.'); return }
    if (!form.sincronizar_desde) { setError('Informe a partir de qual data sincronizar marcações.'); return }

    const info = modeloInfo(form.modelo)
    const isAfd = info?.afd ?? form.usa_afd

    setSubmitting(true)
    try {
      const payload = {
        numero_serie: form.numero_serie.trim(),
        descricao:    form.descricao.trim(),
        modelo:       form.modelo,
        usa_afd:      isAfd,
        ip:           !isAfd && form.ip.trim()      ? form.ip.trim()      : null,
        porta:        !isAfd && form.porta           ? Number(form.porta)  : null,
        usuario:      !isAfd && form.usuario.trim()  ? form.usuario.trim() : null,
        senha:        form.senha.trim() || null,
        filial_id:    form.filial_id ? Number(form.filial_id) : null,
        sincronizar_desde: form.sincronizar_desde,
      }

      if (editingId !== null) {
        await updateRelogio(editingId, { ...payload, ativo: form.ativo })
        setSuccess('Relógio atualizado com sucesso.')
      } else {
        await createRelogio(payload)
        setSuccess('Relógio cadastrado com sucesso.')
        setForm(emptyForm())
        setEditingId(null)
      }
      await loadLista(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (editingId === null) return
    if (!window.confirm('Remover este relógio? Esta ação não pode ser desfeita.')) return
    setDeleting(true)
    try {
      await deleteRelogio(editingId)
      setEditingId(null)
      setPanelOpen(false)
      setForm(emptyForm())
      setSuccess(null)
      setError(null)
      await loadLista(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover.')
    } finally {
      setDeleting(false)
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

  if (!canManage(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores podem gerenciar os relógios de ponto.</p>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  const listaFiltrada = lista.filter(
    (r) =>
      r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      r.numero_serie.toLowerCase().includes(busca.toLowerCase()),
  )

  const isEditing = editingId !== null
  const showForm = panelOpen
  const infoModelo = modeloInfo(form.modelo)
  const isAfd = infoModelo?.afd ?? form.usa_afd

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Relógios de Ponto</h1>
          <p className={styles.subtitle}>
            Cadastre os equipamentos de ponto. O sistema de coleta local usa a rota{' '}
            <code>/api/relogios/sync</code> para obter a lista de relógios ativos.
          </p>
        </div>
        <button type="button" className={styles.btnNew} onClick={startCreating}>
          + Novo relógio
        </button>
      </div>

      <div className={styles.layout}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarLabel}>EQUIPAMENTOS</span>
            <span className={styles.countChip}>{listaFiltrada.length}</span>
          </div>

          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Buscar por descrição ou série…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {loadingLista ? (
            <p className={styles.loading}>Carregando…</p>
          ) : listaFiltrada.length === 0 ? (
            <p className={styles.emptyList}>
              {lista.length === 0 ? 'Nenhum relógio cadastrado.' : 'Nenhum resultado.'}
            </p>
          ) : (
            <ul className={styles.relogioList}>
              {listaFiltrada.map((r) => {
                const info = modeloInfo(r.modelo)
                return (
                  <li
                    key={r.id}
                    className={`${styles.relogioCard} ${editingId === r.id ? styles.relogioCardActive : ''}`}
                    onClick={() => iniciarEdicao(r)}
                  >
                    <div className={styles.cardRow}>
                      <span className={styles.cardNome}>{r.descricao}</span>
                      {!r.ativo && <span className={styles.badgeInativo}>Inativo</span>}
                      {r.ativo && (
                        <span className={r.usa_afd ? styles.badgeAfd : styles.badgeNet}>
                          {r.usa_afd ? 'AFD' : 'Rede'}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardRow}>
                      <span className={styles.cardSerie}>{r.numero_serie}</span>
                      <span className={styles.cardMeta}>{info?.label ?? r.modelo}</span>
                    </div>
                    {r.filial_nome && (
                      <div className={styles.cardRow}>
                        <span className={styles.cardMeta}>{r.filial_nome}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* ── Edit panel ── */}
        <main className={styles.editPanel}>
          {!showForm ? (
            <div className={styles.idleState}>
              <svg className={styles.idleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p>Selecione um relógio à esquerda ou clique em "+ Novo relógio"</p>
            </div>
          ) : (
            <div className={styles.editCard}>
              <div className={styles.editHeader}>
                <div className={styles.editHeaderLeft}>
                  <div className={styles.editIconBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={styles.editTitle}>
                      {isEditing ? 'Editar · ' : 'Novo · '}{form.descricao || 'Relógio de ponto'}
                    </h2>
                    {isEditing && (
                      <p className={styles.editMeta}>
                        Série {form.numero_serie} · {infoModelo?.label ?? form.modelo}
                        {infoModelo && ` · chave: ${infoModelo.chave.toUpperCase()}`}
                      </p>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className={styles.editStatus}>
                    <span className={`${styles.statusDot} ${form.ativo ? styles.statusDotOn : styles.statusDotOff}`} />
                    <select
                      className={styles.statusSelect}
                      value={form.ativo ? '1' : '0'}
                      onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value === '1' }))}
                    >
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
                  </div>
                )}
              </div>

              {error   && <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>}
              {success && <p className={`${styles.feedback} ${styles.feedbackOk}`}    role="status">{success}</p>}

              <form onSubmit={handleSubmit}>
                {/* IDENTIFICAÇÃO */}
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>IDENTIFICAÇÃO</div>
                  <div className={styles.rowTwo}>
                    <div className={styles.field}>
                      <label>DESCRIÇÃO <span className={styles.req}>*</span></label>
                      <input
                        placeholder="Ex: Recepção principal, Portaria A…"
                        value={form.descricao}
                        onChange={update('descricao')}
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>NÚMERO DE SÉRIE <span className={styles.req}>*</span></label>
                      <input
                        placeholder="Ex: 1234567890"
                        value={form.numero_serie}
                        onChange={update('numero_serie')}
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>
                  <div className={styles.rowTwo} style={{ marginTop: '1rem' }}>
                    <div className={styles.field}>
                      <label>MODELO <span className={styles.req}>*</span></label>
                      <select value={form.modelo} onChange={update('modelo')}>
                        {MODELOS_RELOGIO.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      {infoModelo && (
                        <p className={styles.hint}>
                          Coleta via {infoModelo.afd ? 'arquivo AFD (USB/pen drive)' : 'rede TCP/IP'} ·
                          Chave do funcionário: <strong>{infoModelo.chave.toUpperCase()}</strong>
                        </p>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label>FILIAL</label>
                      <select value={form.filial_id} onChange={update('filial_id')}>
                        <option value="">— Nenhuma —</option>
                        {filiais.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SINCRONIZAÇÃO */}
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>SINCRONIZAÇÃO</div>
                  <div style={{ maxWidth: 260 }}>
                    <div className={styles.field}>
                      <label>SINCRONIZAR MARCAÇÕES A PARTIR DE</label>
                      <input
                        type="date"
                        value={form.sincronizar_desde}
                        onChange={update('sincronizar_desde')}
                        required
                      />
                      <p className={styles.hint}>
                        Marcações anteriores a esta data são descartadas. Importante em relógios
                        antigos, para não importar anos de histórico de ex-funcionários.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CONEXÃO (só se não for AFD) */}
                {!isAfd ? (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>CONEXÃO TCP/IP</div>
                    <div className={styles.rowTwo}>
                      <div className={styles.field}>
                        <label>ENDEREÇO IP</label>
                        <input
                          placeholder="192.168.1.100"
                          value={form.ip}
                          onChange={update('ip')}
                          autoComplete="off"
                        />
                        <p className={styles.hint}>IP do relógio na rede local do cliente</p>
                      </div>
                      <div className={styles.field}>
                        <label>PORTA</label>
                        <input
                          type="number"
                          min={1}
                          max={65535}
                          placeholder="80"
                          value={form.porta}
                          onChange={update('porta')}
                        />
                      </div>
                    </div>
                    <div className={styles.rowTwo} style={{ marginTop: '1rem' }}>
                      <div className={styles.field}>
                        <label>USUÁRIO</label>
                        <input
                          placeholder="Usuário do equipamento"
                          value={form.usuario}
                          onChange={update('usuario')}
                          autoComplete="off"
                        />
                      </div>
                      <div className={styles.field}>
                        <label>SENHA</label>
                        <input
                          type="password"
                          placeholder="Senha do equipamento"
                          value={form.senha}
                          onChange={update('senha')}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.infoBox}>
                    <svg className={styles.infoBoxIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <p className={styles.infoBoxText}>
                      Este modelo usa coleta via <strong>arquivo AFD</strong>. O operador insere um pen drive no equipamento
                      e faz o upload do arquivo diretamente no sistema. Não é necessário configurar IP ou porta.
                      {form.senha.trim() === '' ? '' : ''}
                    </p>
                  </div>
                )}

                {/* SENHA para AFD (equipamentos AFD podem ter senha para exportação) */}
                {isAfd && (
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>SEGURANÇA</div>
                    <div style={{ maxWidth: 260 }}>
                      <div className={styles.field}>
                        <label>SENHA DO EQUIPAMENTO</label>
                        <input
                          type="password"
                          placeholder="Opcional"
                          value={form.senha}
                          onChange={update('senha')}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* INFO: endpoint de sync */}
                {isEditing && (
                  <div className={styles.syncCard}>
                    <div className={styles.syncCardTitle}>Endpoint para o sistema de coleta local</div>
                    <p className={styles.syncCardMeta}>
                      Autentique com um token admin e consuma{' '}
                      <code>GET /api/relogios/sync</code> para obter a lista de relógios ativos.
                      O campo <code>usa_afd</code> indica se a coleta é por arquivo; quando{' '}
                      <code>false</code>, use <code>ip</code> e <code>porta</code> para a conexão TCP/IP.
                    </p>
                  </div>
                )}

                <div className={styles.formActions}>
                  {isEditing ? (
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => void handleDelete()}
                      disabled={deleting || submitting}
                    >
                      {deleting ? 'Removendo…' : 'Remover relógio'}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="submit" className={styles.btnSave} disabled={submitting}>
                    {submitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar relógio'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
