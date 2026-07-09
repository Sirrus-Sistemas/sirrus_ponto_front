import { useCallback, useEffect, useState, type ChangeEvent, type ReactElement } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  createLotacao,
  fetchLotacoes,
  horaParaInput,
  updateLotacao,
  type DiaNaoPrevistoTipo,
  type DomingoNaoPrevistoTipo,
  type DomingoTipo,
  type FeriadoTipo,
  type Lotacao,
  type LotacaoPayload,
  type TipoExtra,
  type UpdateLotacaoPayload,
} from '../../services/lotacoesApi'
import styles from './CadastroLotacoesPage.module.css'

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(nome: string): string {
  const w = nome.trim().split(/\s+/)
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : nome.slice(0, 2).toUpperCase()
}

function tipoExtraLabel(t: TipoExtra): string {
  return t === '50_clt' ? '50% CLT' : `${t}%`
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

// ── form ──────────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  nome: '',
  tipo_extra: '50_clt' as TipoExtra,
  calcular_extras_escalonado: false,
  domingo_tipo: '100pct_extra' as DomingoTipo,
  feriado_tipo: '100pct_total' as FeriadoTipo,
  domingo_nao_previsto_tipo: '100pct_total' as DomingoNaoPrevistoTipo,
  dia_nao_previsto_tipo: 'nao_calcular' as DiaNaoPrevistoTipo,
  somar_esq_horas_trabalhadas: false,
  converter_falta_banco_horas: false,
  lancar_100pct_banco_horas: false,
  converter_falta_folha_ponto: false,
  nao_gerar_debitos_meia_falta: false,
  banco_horas_somente_dom_feriado: false,
  dividir_extras_50_100: false,
  calcular_60pct_sabados: false,
  sabado_somente_extras: false,
  juntar_100pct_sabado_normal: false,
  atribuir_100pct_terceiro_domingo: false,
  lancar_debitos_domingo_50pct: false,
  tabela_zerada_e_folga: false,
  calcula_pares_sequenciais_noturno: false,
  hora_inicio_100pct: '',
  hora_inicio_adicional_noturno: '22:00',
  ativo: '1',
})

function lotacaoParaForm(l: Lotacao): ReturnType<typeof emptyForm> {
  return {
    nome: l.nome,
    tipo_extra: l.tipo_extra,
    calcular_extras_escalonado: l.calcular_extras_escalonado === 1,
    domingo_tipo: l.domingo_tipo,
    feriado_tipo: l.feriado_tipo,
    domingo_nao_previsto_tipo: l.domingo_nao_previsto_tipo ?? '100pct_total',
    dia_nao_previsto_tipo: l.dia_nao_previsto_tipo ?? 'nao_calcular',
    somar_esq_horas_trabalhadas: l.somar_esq_horas_trabalhadas === 1,
    converter_falta_banco_horas: l.converter_falta_banco_horas === 1,
    lancar_100pct_banco_horas: l.lancar_100pct_banco_horas === 1,
    converter_falta_folha_ponto: l.converter_falta_folha_ponto === 1,
    nao_gerar_debitos_meia_falta: l.nao_gerar_debitos_meia_falta === 1,
    banco_horas_somente_dom_feriado: l.banco_horas_somente_dom_feriado === 1,
    dividir_extras_50_100: l.dividir_extras_50_100 === 1,
    calcular_60pct_sabados: l.calcular_60pct_sabados === 1,
    sabado_somente_extras: l.sabado_somente_extras === 1,
    juntar_100pct_sabado_normal: l.juntar_100pct_sabado_normal === 1,
    atribuir_100pct_terceiro_domingo: l.atribuir_100pct_terceiro_domingo === 1,
    lancar_debitos_domingo_50pct: l.lancar_debitos_domingo_50pct === 1,
    tabela_zerada_e_folga: l.tabela_zerada_e_folga === 1,
    calcula_pares_sequenciais_noturno: l.calcula_pares_sequenciais_noturno === 1,
    hora_inicio_100pct: horaParaInput(l.hora_inicio_100pct),
    hora_inicio_adicional_noturno: horaParaInput(l.hora_inicio_adicional_noturno) || '22:00',
    ativo: String(l.ativo ?? 1),
  }
}

function formParaPayload(f: ReturnType<typeof emptyForm>): LotacaoPayload {
  return {
    nome: f.nome.trim(),
    tipo_extra: f.tipo_extra,
    calcular_extras_escalonado: f.calcular_extras_escalonado ? 1 : 0,
    domingo_tipo: f.domingo_tipo,
    feriado_tipo: f.feriado_tipo,
    domingo_nao_previsto_tipo: f.domingo_nao_previsto_tipo,
    dia_nao_previsto_tipo: f.dia_nao_previsto_tipo,
    somar_esq_horas_trabalhadas: f.somar_esq_horas_trabalhadas ? 1 : 0,
    converter_falta_banco_horas: f.converter_falta_banco_horas ? 1 : 0,
    lancar_100pct_banco_horas: f.lancar_100pct_banco_horas ? 1 : 0,
    converter_falta_folha_ponto: f.converter_falta_folha_ponto ? 1 : 0,
    nao_gerar_debitos_meia_falta: f.nao_gerar_debitos_meia_falta ? 1 : 0,
    banco_horas_somente_dom_feriado: f.banco_horas_somente_dom_feriado ? 1 : 0,
    dividir_extras_50_100: f.dividir_extras_50_100 ? 1 : 0,
    calcular_60pct_sabados: f.calcular_60pct_sabados ? 1 : 0,
    sabado_somente_extras: f.sabado_somente_extras ? 1 : 0,
    juntar_100pct_sabado_normal: f.juntar_100pct_sabado_normal ? 1 : 0,
    atribuir_100pct_terceiro_domingo: f.atribuir_100pct_terceiro_domingo ? 1 : 0,
    lancar_debitos_domingo_50pct: f.lancar_debitos_domingo_50pct ? 1 : 0,
    tabela_zerada_e_folga: f.tabela_zerada_e_folga ? 1 : 0,
    calcula_pares_sequenciais_noturno: f.calcula_pares_sequenciais_noturno ? 1 : 0,
    hora_inicio_100pct: f.hora_inicio_100pct || null,
    hora_inicio_adicional_noturno: f.hora_inicio_adicional_noturno || '22:00',
  }
}

type Tab = 'geral' | 'domingo' | 'parametros' | 'horarios'

const TABS: { id: Tab; label: string; icon: () => ReactElement }[] = [
  { id: 'geral',      label: 'Geral',             icon: TagIcon },
  { id: 'domingo',    label: 'Domingo & feriado',  icon: CalendarIcon },
  { id: 'parametros', label: 'Parâmetros',         icon: SlidersIcon },
  { id: 'horarios',   label: 'Horários',           icon: ClockIcon },
]

const TIPO_EXTRA_OPTIONS: { value: TipoExtra; label: string }[] = [
  { value: '50_clt', label: '50% CLT' },
  { value: '60',     label: '60%' },
  { value: '80',     label: '80%' },
  { value: '100',    label: '100%' },
]

const DOMINGO_OPTS: { value: DomingoTipo; label: string }[] = [
  { value: 'nao_calcular',  label: 'Não calcular extra' },
  { value: '50pct',         label: 'Calcular horas extras como 50%' },
  { value: '100pct_extra',  label: 'Calcular horas extras como 100%' },
  { value: '100pct_total',  label: 'Calcular horas total como 100%' },
]

const FERIADO_OPTS: { value: FeriadoTipo; label: string }[] = [
  { value: 'nao_calcular',  label: 'Não calcular extra' },
  { value: '50pct',         label: 'Calcular horas extras como 50%' },
  { value: '100pct_extra',  label: 'Calcular horas extras como 100%' },
  { value: '100pct_total',  label: 'Calcular horas total como 100%' },
]

// ── component ─────────────────────────────────────────────────────────────────

export function CadastroLotacoesPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [lista, setLista]               = useState<Lotacao[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [search, setSearch]             = useState('')

  // null = nothing selected; -1 = nova
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [activeTab, setActiveTab]     = useState<Tab>('geral')
  const [form, setForm]               = useState(emptyForm)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<string | null>(null)

  const isNew = selectedId === -1
  const selectedLot = lista.find(l => l.id === selectedId) ?? null

  const loadLista = useCallback((silent = false) => {
    if (!silent) setLoadingLista(true)
    return fetchLotacoes()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

  const setField =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const toggle =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (val: boolean) =>
      setForm(f => ({ ...f, [field]: val }))

  function selecionarLotacao(l: Lotacao) {
    setSelectedId(l.id)
    setForm(lotacaoParaForm(l))
    setActiveTab('geral')
    setError(null)
    setSuccess(null)
  }

  function iniciarNova() {
    setSelectedId(-1)
    setForm(emptyForm())
    setActiveTab('geral')
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
      if (!isNew && selectedId != null) {
        const payload: UpdateLotacaoPayload = {
          ...formParaPayload(form),
          ativo: form.ativo === '0' ? 0 : 1,
        }
        await updateLotacao(selectedId, payload)
        setSuccess('Lotação atualizada com sucesso.')
        await loadLista(true)
      } else {
        const res = await createLotacao(formParaPayload(form)) as { id?: number }
        setSuccess('Lotação cadastrada com sucesso.')
        await loadLista(true)
        if (res?.id) setSelectedId(res.id)
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
        <p>Apenas administradores podem gerenciar lotações.</p>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  const listaFiltrada = lista.filter(l =>
    l.nome.toLowerCase().includes(search.toLowerCase())
  )

  // ── tab content renderers ─────────────────────────────────────────────────

  function renderGeral() {
    return (
      <div className={styles.tabContent}>
        <div className={styles.tabSectionHeader}>
          <div className={styles.tabSectionIconBox}><TagIcon /></div>
          <div>
            <div className={styles.tabSectionTitle}>Identificação</div>
            <div className={styles.tabSectionDesc}>Nome e regra base de hora extra desta lotação.</div>
          </div>
        </div>

        <div className={styles.formStack}>
          <div className={styles.field}>
            <label htmlFor="lot-nome" className={styles.label}>Nome da lotação</label>
            <input id="lot-nome" className={styles.input} value={form.nome} onChange={setField('nome')} autoComplete="off" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="lot-tipo-extra" className={styles.label}>Tipo de hora extra</label>
            <select id="lot-tipo-extra" className={styles.select} value={form.tipo_extra} onChange={setField('tipo_extra')}>
              {TIPO_EXTRA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <ToggleRow
            checked={form.calcular_extras_escalonado}
            onChange={toggle('calcular_extras_escalonado')}
            label="Horas extras escalonadas"
            desc="Aplica 50 / 80 / 80 / 100% conforme a faixa de horas."
          />

          {!isNew && (
            <div className={styles.field}>
              <label htmlFor="lot-ativo" className={styles.label}>Situação</label>
              <select id="lot-ativo" className={styles.select} value={form.ativo} onChange={setField('ativo')}>
                <option value="1">Ativa</option>
                <option value="0">Inativa</option>
              </select>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderDomingo() {
    return (
      <div className={styles.tabContent}>
        <div className={styles.tabSectionHeader}>
          <div className={styles.tabSectionIconBox}><CalendarIcon /></div>
          <div>
            <div className={styles.tabSectionTitle}>Domingo & feriado</div>
            <div className={styles.tabSectionDesc}>Como cada tipo de dia é remunerado, inclusive quando não há escala prevista.</div>
          </div>
        </div>

        <div className={styles.formStack}>
          {/* Tratamento Domingo */}
          <div className={styles.subGroup}>
            <div className={styles.subGroupTitle}><SunIcon /> Tratamento — Domingo</div>
            {DOMINGO_OPTS.map(opt => (
              <label
                key={opt.value}
                className={`${styles.radioRow} ${form.domingo_tipo === opt.value ? styles.radioRowSelected : ''}`}
              >
                <span className={`${styles.radioCircle} ${form.domingo_tipo === opt.value ? styles.radioCircleSelected : ''}`} />
                <span className={styles.radioLabel}>{opt.label}</span>
                <input type="radio" name="domingo_tipo" value={opt.value} checked={form.domingo_tipo === opt.value}
                  onChange={() => setForm(f => ({ ...f, domingo_tipo: opt.value }))} className={styles.radioHidden} />
              </label>
            ))}
          </div>

          {/* Domingo não previsto */}
          <div className={styles.field}>
            <label className={styles.label}>Domingo não previsto na escala</label>
            <p className={styles.fieldDesc}>Funcionário trabalha num domingo sem turno previsto.</p>
            <select className={styles.select} value={form.domingo_nao_previsto_tipo}
              onChange={e => setForm(f => ({ ...f, domingo_nao_previsto_tipo: e.target.value as DomingoNaoPrevistoTipo }))}>
              <option value="nao_calcular">Não calcular extra</option>
              <option value="50pct">50% sobre o excedente</option>
              <option value="100pct_total">100% sobre tudo trabalhado (padrão CLT)</option>
              <option value="igual_feriado">Igual ao tratamento de feriado</option>
            </select>
          </div>

          {/* Tratamento Feriado */}
          <div className={styles.subGroup}>
            <div className={styles.subGroupTitle}><FlagIcon /> Tratamento — Feriado</div>
            {FERIADO_OPTS.map(opt => (
              <label
                key={opt.value}
                className={`${styles.radioRow} ${form.feriado_tipo === opt.value ? styles.radioRowSelected : ''}`}
              >
                <span className={`${styles.radioCircle} ${form.feriado_tipo === opt.value ? styles.radioCircleSelected : ''}`} />
                <span className={styles.radioLabel}>{opt.label}</span>
                <input type="radio" name="feriado_tipo" value={opt.value} checked={form.feriado_tipo === opt.value}
                  onChange={() => setForm(f => ({ ...f, feriado_tipo: opt.value }))} className={styles.radioHidden} />
              </label>
            ))}
          </div>

          {/* Dia útil não previsto */}
          <div className={styles.field}>
            <label className={styles.label}>Dia útil não previsto na escala</label>
            <p className={styles.fieldDesc}>Funcionário trabalha num dia útil sem turno previsto.</p>
            <select className={styles.select} value={form.dia_nao_previsto_tipo}
              onChange={e => setForm(f => ({ ...f, dia_nao_previsto_tipo: e.target.value as DiaNaoPrevistoTipo }))}>
              <option value="nao_calcular">Não calcular extra (padrão conservador)</option>
              <option value="50pct">50% sobre o excedente</option>
              <option value="100pct_total">100% sobre tudo trabalhado</option>
              <option value="igual_domingo">Igual ao tratamento de domingo</option>
            </select>
          </div>
        </div>
      </div>
    )
  }

  function renderParametros() {
    return (
      <div className={styles.tabContent}>
        <div className={styles.tabSectionHeader}>
          <div className={styles.tabSectionIconBox}><SlidersIcon /></div>
          <div>
            <div className={styles.tabSectionTitle}>Parâmetros de cálculo</div>
            <div className={styles.tabSectionDesc}>Ajustes finos de banco de horas, faltas e horas extras.</div>
          </div>
        </div>

        <div className={styles.formStack}>
          <div className={styles.paramGroup}>
            <div className={styles.paramGroupTitle}><BankIcon /> Banco de horas</div>
            <ToggleRow checked={form.lancar_100pct_banco_horas}    onChange={toggle('lancar_100pct_banco_horas')}    label="Lançar horas de 100% no banco de horas" />
            <ToggleRow checked={form.converter_falta_banco_horas}  onChange={toggle('converter_falta_banco_horas')}  label="Converter falta para débito no banco de horas" />
            <ToggleRow checked={form.banco_horas_somente_dom_feriado} onChange={toggle('banco_horas_somente_dom_feriado')} label="Banco de horas somente aos domingos e feriados" />
          </div>

          <div className={styles.paramGroup}>
            <div className={styles.paramGroupTitle}><WarnIcon /> Faltas e débitos</div>
            <ToggleRow checked={form.nao_gerar_debitos_meia_falta} onChange={toggle('nao_gerar_debitos_meia_falta')} label="Não gerar débitos quando tiver falta" />
            <ToggleRow checked={form.converter_falta_folha_ponto}  onChange={toggle('converter_falta_folha_ponto')}  label="Converter falta para débito na folha do ponto" />
            <ToggleRow checked={form.lancar_debitos_domingo_50pct} onChange={toggle('lancar_debitos_domingo_50pct')} label="Lançar débitos aos domingos como 50%" desc="Aplica-se aos domingos escalados." />
          </div>

          <div className={styles.paramGroup}>
            <div className={styles.paramGroupTitle}><ClockIcon /> Horas extras</div>
            <ToggleRow checked={form.somar_esq_horas_trabalhadas} onChange={toggle('somar_esq_horas_trabalhadas')} label="Somar BSQ às horas trabalhadas" />
            <ToggleRow checked={form.dividir_extras_50_100}       onChange={toggle('dividir_extras_50_100')}       label="Dividir horas extras em 50% e 100%" />
            <ToggleRow checked={form.calcular_60pct_sabados}      onChange={toggle('calcular_60pct_sabados')}      label="Calcular horas de 60% aos sábados" />
            {form.calcular_60pct_sabados && (
              <ToggleRow checked={form.sabado_somente_extras}     onChange={toggle('sabado_somente_extras')}       label="Somente extras (sábado 60%)" indent />
            )}
            <ToggleRow checked={form.juntar_100pct_sabado_normal} onChange={toggle('juntar_100pct_sabado_normal')} label="Juntar 100% dos sábados com extras normais" />
          </div>

          <div className={styles.paramGroup}>
            <div className={styles.paramGroupTitle}><ClockIcon /> Turno noturno</div>
            <ToggleRow checked={form.calcula_pares_sequenciais_noturno} onChange={toggle('calcula_pares_sequenciais_noturno')} label="Calcular pares sequenciais para turno noturno" desc="Para turnos que cruzam meia-noite: soma pares de batidas em sequência, sem reordenar por data/hora absoluta. Resolve cálculos incorretos de horas." />
          </div>

          <div className={styles.paramGroup}>
            <div className={styles.paramGroupTitle}><OtherIcon /> Outros</div>
            <ToggleRow checked={form.atribuir_100pct_terceiro_domingo} onChange={toggle('atribuir_100pct_terceiro_domingo')} label="Atribuir 100% no 3º domingo de trabalho" desc="Escala 12×36." />
            <ToggleRow checked={form.tabela_zerada_e_folga}            onChange={toggle('tabela_zerada_e_folga')}            label="Tabela de horas zerada é folga" />
          </div>
        </div>
      </div>
    )
  }

  function renderHorarios() {
    return (
      <div className={styles.tabContent}>
        <div className={styles.tabSectionHeader}>
          <div className={styles.tabSectionIconBox}><ClockIcon /></div>
          <div>
            <div className={styles.tabSectionTitle}>Horários de referência</div>
            <div className={styles.tabSectionDesc}>Marcos usados pelo cálculo. Deixe em branco quando não se aplica.</div>
          </div>
        </div>

        <div className={styles.formStack}>
          <div className={styles.field}>
            <label htmlFor="lot-100pct" className={styles.label}>Início para cálculo de 100%</label>
            <input id="lot-100pct" className={styles.input} type="time" value={form.hora_inicio_100pct} onChange={setField('hora_inicio_100pct')} />
          </div>
          <div className={styles.field}>
            <label htmlFor="lot-noturno" className={styles.label}>Início do adicional noturno</label>
            <input id="lot-noturno" className={styles.input} type="time" value={form.hora_inicio_adicional_noturno} onChange={setField('hora_inicio_adicional_noturno')} />
          </div>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <span className={styles.breadcrumbItem}>Cadastro</span>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>Lotações</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Lotações</h1>
          <p className={styles.subtitle}>Selecione uma lotação para ajustar suas regras de cálculo ou cadastre uma nova.</p>
        </div>
        <button className={styles.btnNova} onClick={iniciarNova}>
          <PlusIcon /> Nova lotação
        </button>
      </div>

      <div className={styles.masterDetail}>

        {/* ── LEFT: lista ── */}
        <div className={styles.listPanel}>
          <div className={styles.searchWrap}>
            <SearchIcon />
            <input className={styles.searchInput} type="search" placeholder="Buscar lotação..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loadingLista ? (
            <p className={styles.listLoading}>Carregando…</p>
          ) : listaFiltrada.length === 0 ? (
            <p className={styles.listEmpty}>Nenhuma lotação encontrada.</p>
          ) : (
            <ul className={styles.lotacaoList}>
              {listaFiltrada.map(l => (
                <li key={l.id}
                  className={`${styles.lotacaoItem} ${selectedId === l.id ? styles.lotacaoItemSelected : ''}`}
                  onClick={() => selecionarLotacao(l)}
                >
                  <div className={styles.avatar}>{initials(l.nome)}</div>
                  <div className={styles.lotacaoInfo}>
                    <span className={styles.lotacaoNome}>{l.nome}</span>
                    <span className={styles.lotacaoSub}>{l.total_funcionarios ?? 0} colaboradores</span>
                  </div>
                  <span className={styles.badgeAtiva}>● Ativa</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── RIGHT: detail ── */}
        <div className={styles.detailPanel}>
          {selectedId == null ? (
            <div className={styles.emptyState}>
              <TagIcon />
              <p>Selecione uma lotação para editar</p>
            </div>
          ) : (
            <div className={styles.detailCard}>
              {/* Header */}
              <div className={styles.detailHeader}>
                <div className={styles.detailIconBox}><TagIcon /></div>
                <div className={styles.detailHeaderInfo}>
                  <span className={styles.detailTitle}>{isNew ? 'Nova lotação' : selectedLot?.nome ?? '—'}</span>
                  {!isNew && selectedLot && (
                    <span className={styles.detailSubtitle}>
                      {selectedLot.total_funcionarios ?? 0} colaboradores · regra base {tipoExtraLabel(selectedLot.tipo_extra)}
                    </span>
                  )}
                </div>
                {!isNew && (
                  <span className={styles.headerBadgeAtiva}><span className={styles.dot} /> Ativa</span>
                )}
              </div>

              {/* Tab bar */}
              <div className={styles.tabBar}>
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <tab.icon />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <form onSubmit={handleSubmit} className={styles.detailForm}>
                {error   && <p className={styles.feedbackError} role="alert">{error}</p>}
                {success && <p className={styles.feedbackOk}    role="status">{success}</p>}

                {activeTab === 'geral'      && renderGeral()}
                {activeTab === 'domingo'    && renderDomingo()}
                {activeTab === 'parametros' && renderParametros()}
                {activeTab === 'horarios'   && renderHorarios()}

                {/* Footer */}
                <div className={styles.formFooter}>
                  {!isNew && selectedLot?.updated_at && (
                    <span className={styles.lastChange}>
                      <ClockIcon /> Última alteração {relativeTime(selectedLot.updated_at)}
                    </span>
                  )}
                  <button type="submit" className={styles.btnSave} disabled={submitting}>
                    {submitting ? 'Salvando…' : isNew ? 'Cadastrar lotação' : 'Salvar alterações'}
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

// ── Toggle row component ──────────────────────────────────────────────────────

function ToggleRow({ checked, onChange, label, desc, indent }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc?: string
  indent?: boolean
}) {
  return (
    <label className={`${styles.toggleRow} ${checked ? styles.toggleRowOn : ''} ${indent ? styles.toggleRowIndent : ''}`}>
      <div className={styles.toggleRowText}>
        <span className={styles.toggleRowLabel}>{label}</span>
        {desc && <span className={styles.toggleRowDesc}>{desc}</span>}
      </div>
      <div className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`} onClick={e => { e.preventDefault(); onChange(!checked) }}>
        <div className={styles.toggleThumb} />
      </div>
    </label>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
}
function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
}
function TagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function SlidersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
}
function ClockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
}
function SunIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function FlagIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
}
function BankIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}
function WarnIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function OtherIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
