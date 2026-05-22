import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchDepartamentos, fetchTurnos, type Departamento, type Turno } from '../../services/cadastrosApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { fetchFiliais, type Filial } from '../../services/filiaisApi'
import { horaParaInput } from '../../services/turnosApi'
import {
  createFuncionario,
  fetchFuncionarios,
  fetchFuncionarioById,
  updateFuncionario,
  type FuncionarioListItem,
} from '../../services/funcionariosApi'
import { digitsOnlyCpf, formatCpf } from '../login/cpf'
import { fetchMunicipios, type Municipio } from '../../services/municipiosApi'
import styles from './CadastroFuncionarioPage.module.css'
import { DatePicker } from '../ui/DatePicker'

type View = 'list' | 'form'

function canManage(role: string | undefined) {
  return role === 'admin' || role === 'gestor'
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  funcionario: 'Funcionário',
}

function cpfDisplay(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function getInitials(nome: string) {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function yearsOfService(dataAdmissao: string) {
  if (!dataAdmissao) return null
  const admDate = new Date(dataAdmissao)
  if (isNaN(admDate.getTime())) return null
  const diff = Date.now() - admDate.getTime()
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  return years
}

function formatDateBR(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  nome: string
  email: string
  cpf: string
  telefone: string
  cargo: string
  matricula: string
  pis: string
  rg: string
  data_nascimento: string
  data_admissao: string
  password: string
  password2: string
  filial_id: string
  departamento_id: string
  turno_id: string
  lotacao_id: string
  role: 'admin' | 'gestor' | 'funcionario'
  usa_escala: boolean
  usa_mobile: boolean
  pontomobile_id: string
  ativo: boolean
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  municipio_id: string
}

const emptyForm = (): FormState => ({
  nome: '',
  email: '',
  cpf: '',
  telefone: '',
  cargo: '',
  matricula: '',
  pis: '',
  rg: '',
  data_nascimento: '',
  data_admissao: '',
  password: '',
  password2: '',
  filial_id: '',
  departamento_id: '',
  turno_id: '',
  lotacao_id: '',
  role: 'funcionario',
  usa_escala: false,
  usa_mobile: false,
  pontomobile_id: '',
  ativo: true,
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  municipio_id: '',
})

// ─── Component ────────────────────────────────────────────────────────────────

export function CadastroFuncionarioPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  // ── views
  const [view, setView] = useState<View>('list')
  const [editingId, setEditingId] = useState<number | null>(null)

  // ── reference data
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  // ── list state
  const [employees, setEmployees] = useState<FuncionarioListItem[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listPages, setListPages] = useState(0)
  const [listPage, setListPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const LIST_LIMIT = 15

  // ── form state
  const [form, setForm] = useState<FormState>(emptyForm)
  const originalFormRef = useRef<FormState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── municipio combobox
  const [municipioQuery, setMunicipioQuery] = useState('')
  const [municipioResults, setMunicipioResults] = useState<Municipio[]>([])
  const [municipioOpen, setMunicipioOpen] = useState(false)

  useEffect(() => {
    if (!municipioQuery.trim()) { setMunicipioResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetchMunicipios({ search: municipioQuery.trim(), limit: 10 })
        if (!cancelled) setMunicipioResults(res.rows)
      } catch { if (!cancelled) setMunicipioResults([]) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [municipioQuery])

  function selectMunicipio(m: Municipio) {
    setForm((f) => ({
      ...f,
      municipio_id: String(m.CODMUNICIPIO),
      cidade: m.NOMEMUNICIPIO,
      estado: m.ESTADO,
    }))
    setMunicipioQuery(`${m.NOMEMUNICIPIO} — ${m.ESTADO}`)
    setMunicipioResults([])
    setMunicipioOpen(false)
  }

  function clearMunicipio() {
    setForm((f) => ({ ...f, municipio_id: '', cidade: '', estado: '' }))
    setMunicipioQuery('')
    setMunicipioResults([])
  }

  // ── Load reference data once
  useEffect(() => {
    let cancelled = false
    setLoadingRefs(true)
    Promise.all([fetchDepartamentos(), fetchTurnos(), fetchLotacoes(), fetchFiliais()])
      .then(([d, t, l, fi]) => {
        if (!cancelled) {
          setDepartamentos(d)
          setTurnos(t)
          setLotacoes(l)
          setFiliais(fi)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingRefs(false) })
    return () => { cancelled = true }
  }, [])

  // ── Load list with debounce
  useEffect(() => {
    if (view !== 'list') return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoadingList(true)
      try {
        const res = await fetchFuncionarios({ search: searchTerm.trim(), page: listPage, limit: LIST_LIMIT })
        if (!cancelled) {
          setEmployees(res.data)
          setListTotal(res.pagination.total)
          setListPages(res.pagination.totalPages)
        }
      } catch {
        if (!cancelled) setEmployees([])
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    }, searchTerm ? 400 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [view, searchTerm, listPage])

  // ── Form helpers
  const update =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }

  const onCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))
  }

  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm(emptyForm())
    originalFormRef.current = null
    setError(null)
    setSuccess(null)
    setView('form')
  }, [])

  const openEdit = useCallback(async (id: number) => {
    setError(null)
    setSuccess(null)
    try {
      const func = await fetchFuncionarioById(id)
      const admissao = func.data_admissao
        ? String(func.data_admissao).split('T')[0]
        : ''
      const validFilial  = filiais.some((f) => f.id === func.filial_id)
      const validDepto   = departamentos.some((d) => d.id === func.departamento_id)
      const validTurno   = turnos.some((t) => t.id === func.turno_id)
      const validLotacao = lotacoes.some((l) => l.id === func.lotacao_id)
      const loaded: FormState = {
        nome: func.nome ?? '',
        email: func.email ?? '',
        cpf: cpfDisplay(func.cpf),
        telefone: func.telefone ?? '',
        cargo: func.cargo ?? '',
        matricula: func.matricula ?? '',
        pis: func.pis ?? '',
        rg: '',
        data_nascimento: '',
        data_admissao: admissao,
        password: '',
        password2: '',
        filial_id:       validFilial  ? String(func.filial_id)       : '',
        departamento_id: validDepto   ? String(func.departamento_id) : '',
        turno_id:        validTurno   ? String(func.turno_id)        : '',
        lotacao_id:      validLotacao ? String(func.lotacao_id)      : '',
        role: func.role ?? 'funcionario',
        usa_escala: !!func.usa_escala,
        usa_mobile: !!func.usa_mobile,
        pontomobile_id: func.pontomobile_id ?? '',
        ativo: !!func.ativo,
        cep: func.cep ?? '',
        logradouro: func.logradouro ?? '',
        numero: func.numero ?? '',
        complemento: func.complemento ?? '',
        bairro: func.bairro ?? '',
        cidade: func.cidade ?? '',
        estado: func.estado ?? '',
        municipio_id: func.municipio_id != null ? String(func.municipio_id) : '',
      }
      setForm(loaded)
      originalFormRef.current = { ...loaded }
      if (func.cidade) {
        setMunicipioQuery(func.estado ? `${func.cidade} — ${func.estado}` : func.cidade)
      } else {
        setMunicipioQuery('')
      }
      setEditingId(id)
      setView('form')
    } catch {
      // keep on list
    }
  }, [departamentos, turnos, lotacoes, filiais])

  const backToList = useCallback(() => {
    setView('list')
    setEditingId(null)
    setError(null)
    setSuccess(null)
    originalFormRef.current = null
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (editingId === null) {
      // ── Create
      const cpfDigits = digitsOnlyCpf(form.cpf)
      if (cpfDigits.length !== 11) { setError('Informe um CPF válido com 11 dígitos.'); return }
      if (!form.password || form.password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
      if (form.password !== form.password2) { setError('As senhas não coincidem.'); return }
      if (!form.data_admissao) { setError('Informe a data de admissão.'); return }

      setSubmitting(true)
      try {
        const payload = {
          nome: form.nome.trim(),
          email: form.email.trim(),
          cpf: cpfDigits,
          data_admissao: form.data_admissao,
          password: form.password,
          role: form.role,
          usa_escala: form.usa_escala ? 1 : 0,
          usa_mobile: form.usa_mobile ? 1 : 0,
        } as Parameters<typeof createFuncionario>[0]

        if (form.telefone.trim()) payload.telefone = form.telefone.trim()
        if (form.cargo.trim()) payload.cargo = form.cargo.trim()
        if (form.matricula.trim()) payload.matricula = form.matricula.trim()
        if (form.pis.trim()) payload.pis = form.pis.trim()
        if (form.filial_id) payload.filial_id = Number(form.filial_id)
        if (form.departamento_id) payload.departamento_id = Number(form.departamento_id)
        if (form.turno_id) payload.turno_id = Number(form.turno_id)
        if (form.lotacao_id) payload.lotacao_id = Number(form.lotacao_id)
        if (form.cep.trim()) payload.cep = form.cep.trim()
        if (form.logradouro.trim()) payload.logradouro = form.logradouro.trim()
        if (form.numero.trim()) payload.numero = form.numero.trim()
        if (form.complemento.trim()) payload.complemento = form.complemento.trim()
        if (form.bairro.trim()) payload.bairro = form.bairro.trim()
        if (form.cidade.trim()) payload.cidade = form.cidade.trim()
        if (form.estado.trim()) payload.estado = form.estado.trim()
        if (form.municipio_id) payload.municipio_id = Number(form.municipio_id)

        await createFuncionario(payload)
        setSuccess('Funcionário cadastrado com sucesso.')
        setForm(emptyForm())
        originalFormRef.current = null
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar.')
      } finally {
        setSubmitting(false)
      }
    } else {
      // ── Update
      if (!form.data_admissao) { setError('Informe a data de admissão.'); return }

      setSubmitting(true)
      try {
        const payload: Parameters<typeof updateFuncionario>[1] = {
          nome: form.nome.trim(),
          email: form.email.trim(),
          data_admissao: form.data_admissao,
          role: form.role,
          ativo: form.ativo ? 1 : 0,
          usa_escala: form.usa_escala ? 1 : 0,
          usa_mobile: form.usa_mobile ? 1 : 0,
          telefone: form.telefone.trim() || null,
          cargo: form.cargo.trim() || null,
          matricula: form.matricula.trim() || null,
          pis: form.pis.trim() || null,
          filial_id: form.filial_id ? Number(form.filial_id) : null,
          departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
          turno_id: form.turno_id ? Number(form.turno_id) : null,
          lotacao_id: form.lotacao_id ? Number(form.lotacao_id) : null,
          cep: form.cep.trim() || null,
          logradouro: form.logradouro.trim() || null,
          numero: form.numero.trim() || null,
          complemento: form.complemento.trim() || null,
          bairro: form.bairro.trim() || null,
          cidade: form.cidade.trim() || null,
          estado: form.estado.trim() || null,
          municipio_id: form.municipio_id ? Number(form.municipio_id) : null,
        }
        await updateFuncionario(editingId, payload)
        originalFormRef.current = { ...form }
        setSuccess('Funcionário atualizado com sucesso.')
        fetchFuncionarios({ search: searchTerm.trim(), page: listPage, limit: LIST_LIMIT })
          .then((res) => { setEmployees(res.data); setListTotal(res.pagination.total); setListPages(res.pagination.totalPages) })
          .catch(() => {})
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

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

  if (!canManage(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores ou gestores podem gerenciar funcionários.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  // ─── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className={styles.page} style={{ maxWidth: '100%' }}>
        <div className={styles.listHeader}>
          <div>
            <h1 className={styles.title}>Funcionários</h1>
            <p className={styles.subtitle}>
              {listTotal > 0 ? `${listTotal} funcionário${listTotal > 1 ? 's' : ''} encontrado${listTotal > 1 ? 's' : ''}` : 'Nenhum funcionário'}
            </p>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={openCreate}>
            + Novo funcionário
          </button>
        </div>

        <div className={styles.searchBar}>
          <input
            type="search"
            placeholder="Buscar por nome, CPF ou matrícula…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setListPage(1) }}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.tableCard}>
          {loadingList ? (
            <p className={styles.loading} style={{ padding: '2rem' }}>Carregando…</p>
          ) : employees.length === 0 ? (
            <p className={styles.emptyState}>Nenhum funcionário encontrado.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Cargo</th>
                    <th>Filial / Departamento</th>
                    <th>Turno</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <span className={styles.empNome}>{emp.nome}</span>
                        {emp.matricula && <span className={styles.empMat}> · {emp.matricula}</span>}
                      </td>
                      <td className={styles.monoCell}>{cpfDisplay(emp.cpf)}</td>
                      <td>{emp.cargo ?? '—'}</td>
                      <td>
                        {emp.filial_nome && <span className={styles.chip}>{emp.filial_nome}</span>}
                        {emp.departamento_nome && <span className={styles.chipGray}>{emp.departamento_nome}</span>}
                        {!emp.filial_nome && !emp.departamento_nome && '—'}
                      </td>
                      <td>{emp.turno_nome ?? '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[`role_${emp.role}`]}`}>
                          {ROLE_LABELS[emp.role] ?? emp.role}
                        </span>
                      </td>
                      <td>
                        <span className={emp.ativo ? styles.badgeAtivo : styles.badgeInativo}>
                          {emp.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnEdit}
                          onClick={() => void openEdit(emp.id)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {listPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={listPage <= 1}
                onClick={() => setListPage((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {listPage} de {listPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={listPage >= listPages}
                onClick={() => setListPage((p) => p + 1)}
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── FORM VIEW ───────────────────────────────────────────────────────────────
  const isEdit = editingId !== null

  // Dirty count
  const dirtyCount = originalFormRef.current
    ? (Object.keys(form) as (keyof FormState)[]).filter(
        (k) => k !== 'password' && k !== 'password2' && String(form[k]) !== String(originalFormRef.current![k])
      ).length
    : 0

  // Header info derived from form
  const selectedTurno = turnos.find((t) => String(t.id) === form.turno_id)
  const turnoBadgeLabel = selectedTurno
    ? `${horaParaInput(selectedTurno.entrada)}–${horaParaInput(selectedTurno.saida)}`
    : null

  const selectedFilial = filiais.find((f) => String(f.id) === form.filial_id)
  const selectedDepto = departamentos.find((d) => String(d.id) === form.departamento_id)

  const years = yearsOfService(form.data_admissao)

  const metaParts: string[] = []
  if (form.cpf) metaParts.push(form.cpf)
  metaParts.push(`matrícula — ${form.matricula || 'não definida'}`)
  if (form.cargo) metaParts.push(form.cargo)
  if (selectedDepto) metaParts.push(selectedDepto.nome)
  if (selectedFilial) metaParts.push(selectedFilial.nome + (selectedFilial.cidade ? ` — ${selectedFilial.cidade}` : ''))
  if (years !== null) metaParts.push(`${years} ${years === 1 ? 'ano' : 'anos'} de casa · admitido em ${formatDateBR(form.data_admissao)}`)

  return (
    <div className={styles.formPage}>
      {/* ── Breadcrumb */}
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.btnBack} onClick={backToList}>
          ← Voltar
        </button>
        <span className={styles.breadcrumbSep}>·</span>
        <span className={styles.breadcrumbItem}>Cadastro</span>
        <span className={styles.breadcrumbSep}>·</span>
        <span className={styles.breadcrumbItem}>Funcionários</span>
      </div>

      {/* ── Profile bar */}
      <div className={styles.profileBar}>
        <div className={styles.profileLeft}>
          {isEdit ? (
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>{getInitials(form.nome)}</div>
            </div>
          ) : null}
          <div className={styles.profileInfo}>
            <div className={styles.profileTitleRow}>
              <h1 className={styles.profileName}>
                {isEdit
                  ? (form.nome || 'Novo funcionário')
                  : 'Novo funcionário'}
              </h1>
              {isEdit && (
                <>
                  <span className={form.ativo ? styles.pillAtivo : styles.pillInativo}>
                    <span className={styles.pillDot} />
                    {form.ativo ? 'ATIVO' : 'INATIVO'}
                  </span>
                  {turnoBadgeLabel && (
                    <span className={styles.pillNeutral}>
                      {turnoBadgeLabel}
                    </span>
                  )}
                </>
              )}
            </div>
            {isEdit && metaParts.length > 0 && (
              <p className={styles.profileMeta}>{metaParts.join('   ·   ')}</p>
            )}
          </div>
        </div>

        <div className={styles.profileActions}>
          {isEdit && dirtyCount > 0 && (
            <span className={styles.dirtyLabel}>
              alterações não salvas · {dirtyCount} {dirtyCount === 1 ? 'campo' : 'campos'}
            </span>
          )}
          <button type="button" className={styles.btnGhost} onClick={backToList} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            form="employee-form"
            className={styles.btnPrimary}
            disabled={submitting}
          >
            {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>

      {/* ── Feedback */}
      {error && (
        <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{error}</p>
      )}
      {success && (
        <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{success}</p>
      )}

      {/* ── 3-panel grid */}
      <form id="employee-form" onSubmit={handleSubmit} noValidate>
        <div className={styles.panelGrid}>

          {/* Panel 1: Dados Pessoais */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelDot} style={{ background: '#14918b' }} />
              <span className={styles.panelTitle}>DADOS PESSOAIS</span>
              <span className={styles.panelCount}>8 campos</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="cf-nome">Nome completo <span className={styles.req}>*</span></label>
              <input id="cf-nome" required minLength={3} autoComplete="name" value={form.nome} onChange={update('nome')} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: '0 0 160px' }}>
                <label htmlFor="cf-cpf">
                  CPF <span className={styles.req}>*</span>
                  {isEdit && <span className={styles.lockIcon}>🔒</span>}
                </label>
                <input
                  id="cf-cpf"
                  required={!isEdit}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  readOnly={isEdit}
                  value={form.cpf}
                  onChange={isEdit ? undefined : onCpfChange}
                  className={isEdit ? styles.inputReadonly : undefined}
                />
                {isEdit && <p className={styles.hint}>não pode ser alterado por aqui</p>}
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-nasc">Data de nascimento</label>
                <DatePicker
                  id="cf-nasc"
                  value={form.data_nascimento}
                  onChange={update('data_nascimento')}
                />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-rg">RG</label>
                <input id="cf-rg" placeholder="0000000 SSP/UF" value={form.rg} onChange={update('rg')} />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-pis">PIS / PASEP <span className={styles.req}>*</span></label>
                <input id="cf-pis" value={form.pis} onChange={update('pis')} />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="cf-email">E-mail</label>
              <div className={styles.inputIconWrap}>
                <span className={styles.inputIcon}>✉</span>
                <input id="cf-email" type="email" required autoComplete="email" value={form.email} onChange={update('email')} style={{ paddingLeft: '2rem' }} />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-tel">Telefone</label>
                <input id="cf-tel" value={form.telefone} onChange={update('telefone')} />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-adm">Data de admissão <span className={styles.req}>*</span></label>
                <DatePicker id="cf-adm" required value={form.data_admissao} onChange={update('data_admissao')} />
              </div>
            </div>

            {!isEdit && (
              <>
                <div className={styles.field}>
                  <label htmlFor="cf-senha">Senha inicial <span className={styles.req}>*</span></label>
                  <input id="cf-senha" type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={update('password')} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="cf-senha2">Confirmar senha <span className={styles.req}>*</span></label>
                  <input id="cf-senha2" type="password" required minLength={6} autoComplete="new-password" value={form.password2} onChange={update('password2')} />
                </div>
              </>
            )}
          </div>

          {/* Panel 2: Vínculo & Acesso */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelDot} style={{ background: '#f97316' }} />
              <span className={styles.panelTitle}>VÍNCULO &amp; ACESSO</span>
              <span className={styles.panelCount}>8 campos</span>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-cargo">Cargo <span className={styles.req}>*</span></label>
                <input id="cf-cargo" value={form.cargo} onChange={update('cargo')} />
              </div>
              <div className={styles.field} style={{ flex: '0 0 140px' }}>
                <label htmlFor="cf-mat">Matrícula</label>
                <input id="cf-mat" value={form.matricula} onChange={update('matricula')} placeholder="—" />
              </div>
            </div>

            {isEdit && (
              <div className={styles.field}>
                <label htmlFor="cf-status">Status do colaborador</label>
                <select
                  id="cf-status"
                  value={form.ativo ? 'ativo' : 'inativo'}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value === 'ativo' }))}
                  className={form.ativo ? styles.selectAtivo : styles.selectInativo}
                >
                  <option value="ativo">● ATIVO</option>
                  <option value="inativo">○ INATIVO</option>
                </select>
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="cf-filial">Filial <span className={styles.req}>*</span></label>
              <select id="cf-filial" value={form.filial_id} onChange={update('filial_id')} disabled={loadingRefs}>
                <option value="">— Nenhuma —</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}{f.cidade ? ` — ${f.cidade}` : ''}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-dept">Departamento <span className={styles.req}>*</span></label>
                <select id="cf-dept" value={form.departamento_id} onChange={update('departamento_id')} disabled={loadingRefs}>
                  <option value="">— Nenhum —</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-lotacao">Lotação</label>
                <select id="cf-lotacao" value={form.lotacao_id} onChange={update('lotacao_id')} disabled={loadingRefs}>
                  <option value="">— Nenhuma —</option>
                  {lotacoes.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="cf-turno">Turno <span className={styles.req}>*</span></label>
              <select id="cf-turno" value={form.turno_id} onChange={update('turno_id')} disabled={loadingRefs}>
                <option value="">— Nenhum —</option>
                {turnos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({horaParaInput(t.entrada)}–{horaParaInput(t.saida)} · {t.batidas_esperadas_dia ?? 8} bat./dia)
                  </option>
                ))}
              </select>
              {selectedTurno && (
                <p className={styles.hint}>
                  {selectedTurno.nome} · {horaParaInput(selectedTurno.entrada)}–{horaParaInput(selectedTurno.saida)} · {selectedTurno.batidas_esperadas_dia ?? 8} bat./dia
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="cf-role">Perfil de acesso <span className={styles.req}>*</span></label>
              <select id="cf-role" value={form.role} onChange={update('role')}>
                <option value="funcionario">Funcionário</option>
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className={styles.toggleCard}>
              <div className={styles.toggleInfo}>
                <p className={styles.toggleLabel}>Usa escala gerada</p>
                <p className={styles.toggleDesc}>
                  regime de escala (12×36, 1×5 etc.) · sem escala, espera seg–sáb
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.usa_escala}
                className={`${styles.toggle} ${form.usa_escala ? styles.toggleOn : ''}`}
                onClick={() => setForm((f) => ({ ...f, usa_escala: !f.usa_escala }))}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>

            {/* Ponto Mobile */}
            <div className={styles.toggleRow}>
              <div className={styles.toggleLabel}>
                <p className={styles.toggleTitle}>Bate ponto no mobile</p>
                <p className={styles.toggleDesc}>
                  {form.pontomobile_id
                    ? 'Marca presença pelo app Sirrus Ponto Mobile'
                    : 'Sincronize o funcionário com o mobile para habilitar'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.usa_mobile}
                disabled={!form.pontomobile_id}
                className={`${styles.toggle} ${form.usa_mobile ? styles.toggleOn : ''}`}
                onClick={() => setForm((f) => ({ ...f, usa_mobile: !f.usa_mobile }))}
                style={!form.pontomobile_id ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>

            <div className={styles.fieldRow} style={{ marginTop: '0.5rem' }}>
              <div className={styles.field}>
                <label>Ponto ID</label>
                <input
                  value={form.pontomobile_id || '—'}
                  readOnly
                  tabIndex={-1}
                  style={{ background: '#f3f4f6', color: form.pontomobile_id ? '#111' : '#9ca3af', fontFamily: 'monospace', letterSpacing: '0.1em', cursor: 'default' }}
                />
              </div>
            </div>
          </div>

          {/* Panel 3: Endereço */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelDot} style={{ background: '#6366f1' }} />
              <span className={styles.panelTitle}>ENDEREÇO</span>
              <span className={styles.panelCount}>7 campos</span>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: '0 0 130px' }}>
                <label htmlFor="cf-cep">CEP</label>
                <input id="cf-cep" inputMode="numeric" maxLength={9} value={form.cep} onChange={update('cep')} placeholder="00000-000" />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-logradouro">Logradouro</label>
                <input id="cf-logradouro" placeholder="Rua, avenida…" value={form.logradouro} onChange={update('logradouro')} />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: '0 0 90px' }}>
                <label htmlFor="cf-numero">Número</label>
                <input id="cf-numero" inputMode="numeric" placeholder="—" value={form.numero} onChange={(e) => { if (/^\d*$/.test(e.target.value)) update('numero')(e) }} />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="cf-complemento">Complemento</label>
                <input id="cf-complemento" placeholder="apto, bloco…" value={form.complemento} onChange={update('complemento')} />
              </div>
              <div className={styles.field} style={{ flex: '0 0 80px' }}>
                <label htmlFor="cf-uf">UF</label>
                <input
                  id="cf-uf"
                  maxLength={2}
                  readOnly
                  value={form.estado}
                  placeholder="RO"
                  className={styles.inputReadonly}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="cf-bairro">Bairro</label>
              <input id="cf-bairro" value={form.bairro} onChange={update('bairro')} />
            </div>

            <div className={styles.field}>
              <label htmlFor="cf-municipio">Cidade / Município</label>
              <div className={styles.comboWrap}>
                <span className={styles.comboSearchIcon}>🔍</span>
                <input
                  id="cf-municipio"
                  autoComplete="off"
                  placeholder="Digite para buscar…"
                  value={municipioQuery}
                  onChange={(e) => {
                    setMunicipioQuery(e.target.value)
                    setMunicipioOpen(true)
                    if (!e.target.value.trim()) clearMunicipio()
                  }}
                  onFocus={() => setMunicipioOpen(true)}
                  onBlur={() => setTimeout(() => setMunicipioOpen(false), 150)}
                  style={{ paddingLeft: '2rem' }}
                />
                {form.municipio_id && (
                  <button
                    type="button"
                    className={styles.comboClear}
                    onClick={clearMunicipio}
                    aria-label="Limpar cidade"
                  >✕</button>
                )}
                {municipioOpen && municipioResults.length > 0 && (
                  <ul className={styles.comboList}>
                    {municipioResults.map((m) => (
                      <li
                        key={m.CODMUNICIPIO}
                        className={styles.comboItem}
                        onMouseDown={() => selectMunicipio(m)}
                      >
                        <span className={styles.comboNome}>{m.NOMEMUNICIPIO}</span>
                        <span className={styles.comboUf}>{m.ESTADO}</span>
                        <span className={styles.comboFuso}>{m.fuso_horario}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className={styles.hint}>define o fuso horário do colaborador</p>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}
