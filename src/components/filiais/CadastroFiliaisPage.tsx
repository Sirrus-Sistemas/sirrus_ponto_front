import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
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

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(nome: string): string {
  const words = nome.trim().split(/\s+/)
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : nome.slice(0, 2).toUpperCase()
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

// ── form state ────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  nome: '',
  tipo_documento: 'cnpj' as 'cnpj' | 'cpf',
  cnpj: '',
  telefone: '',
  num_registradora: '',
  email: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  ativa: '1',
})

function filialParaForm(f: Filial): ReturnType<typeof emptyForm> {
  return {
    nome: f.nome,
    tipo_documento: f.tipo_documento ?? 'cnpj',
    cnpj: f.cnpj ?? '',
    telefone: f.telefone ?? '',
    num_registradora: f.num_registradora ?? '',
    email: f.email ?? '',
    endereco: f.endereco ?? '',
    bairro: f.bairro ?? '',
    cidade: f.cidade ?? '',
    uf: f.uf ?? '',
    cep: f.cep ?? '',
    ativa: String(f.ativa ?? 1),
  }
}

// ── component ────────────────────────────────────────────────────────────────

export function CadastroFiliaisPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista, setLista]             = useState<Filial[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [search, setSearch]           = useState('')

  // null = nenhuma selecionada; -1 = modo nova filial
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [form, setForm]               = useState(emptyForm)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<string | null>(null)

  const isNew = selectedId === -1
  const selectedFilial = lista.find(f => f.id === selectedId) ?? null

  const loadLista = useCallback((silent = false) => {
    if (!silent) setLoadingLista(true)
    return fetchFiliais()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

  const update =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  function selecionarFilial(f: Filial) {
    setSelectedId(f.id)
    setForm(filialParaForm(f))
    setError(null)
    setSuccess(null)
  }

  function iniciarNova() {
    setSelectedId(-1)
    setForm(emptyForm())
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.nome.trim().length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const payload: CreateFilialPayload = {
        nome:             form.nome.trim(),
        tipo_documento:   form.tipo_documento,
        cnpj:             form.cnpj.trim() || null,
        telefone:         form.telefone.trim() || null,
        num_registradora: form.num_registradora.trim() || null,
        email:            form.email.trim() || null,
        endereco:         form.endereco.trim() || null,
        bairro:           form.bairro.trim() || null,
        cidade:           form.cidade.trim() || null,
        uf:               form.uf.trim().toUpperCase() || null,
        cep:              form.cep.trim() || null,
      }

      if (!isNew && selectedId != null) {
        const upd: UpdateFilialPayload = { ...payload, ativa: form.ativa === '0' ? 0 : 1 }
        await updateFilial(selectedId, upd)
        setSuccess('Filial atualizada com sucesso.')
        await loadLista(true)
        // Refresh form with latest data
        const atualizada = await fetchFiliais().then(l => l.find(f => f.id === selectedId))
        if (atualizada) setForm(filialParaForm(atualizada))
      } else {
        const res = await createFilial(payload) as { id?: number }
        setSuccess('Filial cadastrada com sucesso.')
        await loadLista(true)
        if (res?.id) {
          setSelectedId(res.id)
          setForm(emptyForm())
        } else {
          setSelectedId(null)
          setForm(emptyForm())
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── guards ────────────────────────────────────────────────────────────────

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me) {
    return (
      <div className={styles.denied}>
        <h2>Não foi possível carregar seu perfil</h2>
        <p>Verifique a conexão e faça login novamente.</p>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  if (me.role !== 'admin') {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores podem gerenciar filiais.</p>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  // ── filtered list ─────────────────────────────────────────────────────────

  const listaFiltrada = lista.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.cidade ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Localização">
        <span className={styles.breadcrumbItem}>Cadastro</span>
        <span className={styles.breadcrumbSep} aria-hidden>/</span>
      </nav>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Filiais</h1>
          <p className={styles.subtitle}>Selecione uma unidade para editar ou cadastre uma nova filial.</p>
        </div>
        <button className={styles.btnNova} onClick={iniciarNova}>
          <PlusIcon /> Nova filial
        </button>
      </div>

      {/* Master-detail */}
      <div className={styles.masterDetail}>

        {/* ── LEFT: lista ── */}
        <div className={styles.listPanel}>
          <div className={styles.searchWrap}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Buscar filial..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loadingLista ? (
            <p className={styles.listLoading}>Carregando…</p>
          ) : listaFiltrada.length === 0 ? (
            <p className={styles.listEmpty}>Nenhuma filial encontrada.</p>
          ) : (
            <ul className={styles.filialList}>
              {listaFiltrada.map(f => (
                <li
                  key={f.id}
                  className={`${styles.filialItem} ${selectedId === f.id ? styles.filialItemSelected : ''}`}
                  onClick={() => selecionarFilial(f)}
                >
                  <div className={styles.avatar}>{initials(f.nome)}</div>
                  <div className={styles.filialInfo}>
                    <span className={styles.filialNome}>{f.nome}</span>
                    <span className={styles.filialSub}>
                      {[f.cidade, f.uf].filter(Boolean).join(' / ')}
                      {f.total_funcionarios != null ? ` · ${f.total_funcionarios} colab.` : ''}
                    </span>
                  </div>
                  <span className={f.ativa === 0 ? styles.badgeInativa : styles.badgeAtiva}>
                    {f.ativa === 0 ? 'Inativa' : 'Ativa'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── RIGHT: detail/form ── */}
        <div className={styles.detailPanel}>
          {selectedId == null ? (
            <div className={styles.emptyState}>
              <BranchIcon size={40} />
              <p>Selecione uma filial para editar</p>
            </div>
          ) : (
            <div className={styles.detailCard}>
              {/* Card header */}
              <div className={styles.detailHeader}>
                <div className={styles.detailIconBox}><BranchIcon size={20} /></div>
                <div className={styles.detailHeaderInfo}>
                  <span className={styles.detailTitle}>
                    {isNew ? 'Nova filial' : selectedFilial?.nome ?? '—'}
                  </span>
                  {!isNew && selectedFilial && (
                    <span className={styles.detailSubtitle}>
                      Documento {selectedFilial.tipo_documento?.toUpperCase() ?? 'CNPJ'}
                      {selectedFilial.num_registradora ? ` · relógio #${selectedFilial.num_registradora}` : ''}
                    </span>
                  )}
                </div>
                {!isNew && selectedFilial && (
                  <span className={selectedFilial.ativa === 0 ? styles.headerBadgeInativa : styles.headerBadgeAtiva}>
                    <span className={styles.dot} />
                    {selectedFilial.ativa === 0 ? 'Inativa' : 'Ativa'}
                  </span>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className={styles.detailForm} noValidate>
                {error   && <p className={styles.feedbackError} role="alert">{error}</p>}
                {success && <p className={styles.feedbackOk}    role="status">{success}</p>}

                {/* IDENTIFICAÇÃO */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <BranchIcon size={14} />
                    <span>Identificação</span>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={`${styles.field} ${styles.gridFull}`}>
                      <label htmlFor="fil-nome" className={styles.label}>Nome da filial</label>
                      <input id="fil-nome" className={styles.input} value={form.nome} onChange={update('nome')} autoComplete="off" required />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-tipo" className={styles.label}>Tipo de documento</label>
                      <select id="fil-tipo" className={styles.select} value={form.tipo_documento} onChange={update('tipo_documento')}>
                        <option value="cnpj">CNPJ</option>
                        <option value="cpf">CPF</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-cnpj" className={styles.label}>{form.tipo_documento === 'cpf' ? 'CPF' : 'CNPJ'}</label>
                      <input id="fil-cnpj" className={styles.input} value={form.cnpj} onChange={update('cnpj')} autoComplete="off" />
                    </div>
                    {!isNew && (
                      <div className={styles.field}>
                        <label htmlFor="fil-ativa" className={styles.label}>Situação</label>
                        <select id="fil-ativa" className={styles.select} value={form.ativa} onChange={update('ativa')}>
                          <option value="1">Ativa</option>
                          <option value="0">Inativa</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTATO */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <PhoneIcon />
                    <span>Contato</span>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label htmlFor="fil-tel" className={styles.label}>Telefone</label>
                      <input id="fil-tel" className={styles.input} value={form.telefone} onChange={update('telefone')} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-reg" className={styles.label}>Nº da registradora</label>
                      <input id="fil-reg" className={styles.input} value={form.num_registradora} onChange={update('num_registradora')} autoComplete="off" />
                    </div>
                    <div className={`${styles.field} ${styles.gridFull}`}>
                      <label htmlFor="fil-email" className={styles.label}>E-mail</label>
                      <input id="fil-email" className={styles.input} type="email" value={form.email} onChange={update('email')} />
                    </div>
                  </div>
                </div>

                {/* ENDEREÇO */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <PinIcon />
                    <span>Endereço</span>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={`${styles.field} ${styles.gridFull}`}>
                      <label htmlFor="fil-end" className={styles.label}>Endereço</label>
                      <input id="fil-end" className={styles.input} value={form.endereco} onChange={update('endereco')} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-bairro" className={styles.label}>Bairro</label>
                      <input id="fil-bairro" className={styles.input} value={form.bairro} onChange={update('bairro')} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-cidade" className={styles.label}>Cidade</label>
                      <input id="fil-cidade" className={styles.input} value={form.cidade} onChange={update('cidade')} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-uf" className={styles.label}>UF</label>
                      <input id="fil-uf" className={styles.input} maxLength={2} value={form.uf} onChange={update('uf')} style={{ textTransform: 'uppercase' }} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="fil-cep" className={styles.label}>CEP</label>
                      <input id="fil-cep" className={styles.input} value={form.cep} onChange={update('cep')} />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className={styles.formFooter}>
                  {!isNew && selectedFilial?.updated_at && (
                    <span className={styles.lastChange}>
                      <ClockIcon />
                      Última alteração {relativeTime(selectedFilial.updated_at)}
                    </span>
                  )}
                  <button type="submit" className={styles.btnSave} disabled={submitting}>
                    {submitting ? 'Salvando…' : isNew ? 'Cadastrar filial' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function BranchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  )
}
