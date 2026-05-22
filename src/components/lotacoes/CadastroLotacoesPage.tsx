import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  createLotacao,
  fetchLotacoes,
  horaParaInput,
  updateLotacao,
  type DomingoTipo,
  type FeriadoTipo,
  type Lotacao,
  type LotacaoPayload,
  type TipoExtra,
  type UpdateLotacaoPayload,
} from '../../services/lotacoesApi'
import styles from './CadastroLotacoesPage.module.css'

function podeGerirLotacoes(role: string | undefined) {
  return role === 'admin'
}

const emptyForm = () => ({
  nome: '',
  tipo_extra: '50_clt' as TipoExtra,
  calcular_extras_escalonado: false,
  domingo_tipo: '100pct_extra' as DomingoTipo,
  feriado_tipo: '100pct_total' as FeriadoTipo,
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
    hora_inicio_100pct: f.hora_inicio_100pct || null,
    hora_inicio_adicional_noturno: f.hora_inicio_adicional_noturno || '22:00',
  }
}

const LABEL_DOMINGO: Record<DomingoTipo, string> = {
  nao_calcular: 'Não calcular extra',
  '50pct': 'Calcular horas extras como 50%',
  '100pct_extra': 'Calcular horas extras como 100%',
  '100pct_total': 'Calcular horas total como 100%',
}

const LABEL_FERIADO: Record<FeriadoTipo, string> = {
  nao_calcular: 'Não calcular extra',
  '50pct': 'Calcular horas extras como 50%',
  '100pct_extra': 'Calcular horas extras como 100%',
  '100pct_total': 'Calcular horas total como 100%',
}

export function CadastroLotacoesPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [lista, setLista] = useState<Lotacao[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadLista = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingLista(true)
    return fetchLotacoes()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => { if (!opts?.silent) setLoadingLista(false) })
  }, [])

  useEffect(() => { void loadLista() }, [loadLista])

  const updateField =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }

  const toggleCheck =
    (field: keyof ReturnType<typeof emptyForm>) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.checked }))
    }

  function cancelarEdicao() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  function iniciarEdicao(l: Lotacao) {
    setEditingId(l.id)
    setForm(lotacaoParaForm(l))
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

    setSubmitting(true)
    try {
      if (editingId != null) {
        const payload: UpdateLotacaoPayload = {
          ...formParaPayload(form),
          ativo: form.ativo === '0' ? 0 : 1,
        }
        await updateLotacao(editingId, payload)
        setSuccess('Lotação atualizada com sucesso.')
        cancelarEdicao()
      } else {
        await createLotacao(formParaPayload(form))
        setSuccess('Lotação cadastrada com sucesso.')
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

  if (!podeGerirLotacoes(me.role)) {
    return (
      <div className={styles.denied}>
        <h2>Acesso restrito</h2>
        <p>Apenas administradores podem gerenciar lotações.</p>
        <p style={{ marginTop: '0.75rem' }}><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Cadastro de lotações</h1>
      <p className={styles.subtitle}>
        Define as regras de cálculo de horas extras, banco de horas e adicionais por lotação.
        Cada funcionário pode ter uma lotação diferente mesmo dentro do mesmo departamento.
      </p>

      {/* ─── FORMULÁRIO ─────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          {editingId != null ? `Editando lotação #${editingId}` : 'Nova lotação'}
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

          {/* Nome + tipo extra */}
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.gridFull}`}>
              <label htmlFor="lot-nome">Nome da lotação</label>
              <input
                id="lot-nome"
                name="nome"
                required
                autoComplete="off"
                value={form.nome}
                onChange={updateField('nome')}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="lot-tipo-extra">Tipo de hora extra</label>
              <select id="lot-tipo-extra" value={form.tipo_extra} onChange={updateField('tipo_extra')}>
                <option value="50_clt">50% CLT</option>
                <option value="60">60%</option>
                <option value="80">80%</option>
                <option value="100">100%</option>
              </select>
            </div>
            <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
              <label className={styles.checkLabel} style={{ marginTop: 'auto', paddingBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={form.calcular_extras_escalonado}
                  onChange={toggleCheck('calcular_extras_escalonado')}
                />
                Calcular horas extras 50/60/80/100% (escalonado)
              </label>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Domingo e Feriado */}
          <div className={styles.grid}>
            <div className={styles.field}>
              <label>Tratamento Domingo</label>
              <div className={styles.radioGroup}>
                {(Object.keys(LABEL_DOMINGO) as DomingoTipo[]).map((v) => (
                  <label key={v} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="domingo_tipo"
                      value={v}
                      checked={form.domingo_tipo === v}
                      onChange={() => setForm((f) => ({ ...f, domingo_tipo: v }))}
                    />
                    {LABEL_DOMINGO[v]}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label>Tratamento Feriado</label>
              <div className={styles.radioGroup}>
                {(Object.keys(LABEL_FERIADO) as FeriadoTipo[]).map((v) => (
                  <label key={v} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="feriado_tipo"
                      value={v}
                      checked={form.feriado_tipo === v}
                      onChange={() => setForm((f) => ({ ...f, feriado_tipo: v }))}
                    />
                    {LABEL_FERIADO[v]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Flags de cálculo */}
          <p className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>Parâmetros de cálculo</p>
          <div className={styles.checkGrid}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.somar_esq_horas_trabalhadas} onChange={toggleCheck('somar_esq_horas_trabalhadas')} />
              Somar ESQ às horas trabalhadas
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.converter_falta_banco_horas} onChange={toggleCheck('converter_falta_banco_horas')} />
              Converter falta para débito no banco de horas
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.lancar_100pct_banco_horas} onChange={toggleCheck('lancar_100pct_banco_horas')} />
              Lançar horas de 100% no banco de horas
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.converter_falta_folha_ponto} onChange={toggleCheck('converter_falta_folha_ponto')} />
              Converter falta para débito na folha de ponto
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.nao_gerar_debitos_meia_falta} onChange={toggleCheck('nao_gerar_debitos_meia_falta')} />
              Não gerar débitos quando tiver meia falta
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.banco_horas_somente_dom_feriado} onChange={toggleCheck('banco_horas_somente_dom_feriado')} />
              Banco de horas somente aos domingos e feriados
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.dividir_extras_50_100} onChange={toggleCheck('dividir_extras_50_100')} />
              Dividir horas extras 50 e 100%
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.calcular_60pct_sabados} onChange={toggleCheck('calcular_60pct_sabados')} />
              Calcular horas de 60% aos sábados
            </label>
            <label className={`${styles.checkLabel} ${styles.checkLabelSub}`}>
              <input
                type="checkbox"
                checked={form.sabado_somente_extras}
                onChange={toggleCheck('sabado_somente_extras')}
                disabled={!form.calcular_60pct_sabados}
              />
              Somente extras (sábado 60%)
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.juntar_100pct_sabado_normal} onChange={toggleCheck('juntar_100pct_sabado_normal')} />
              Juntar horas de 100% dos sábados com extras de 100% normais
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.atribuir_100pct_terceiro_domingo} onChange={toggleCheck('atribuir_100pct_terceiro_domingo')} />
              Atribuir hora de 100% no 3º domingo de trabalho (escala 12×36)
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.lancar_debitos_domingo_50pct} onChange={toggleCheck('lancar_debitos_domingo_50pct')} />
              Lançar débitos aos domingos como 50% (domingos escalados)
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.tabela_zerada_e_folga} onChange={toggleCheck('tabela_zerada_e_folga')} />
              Tabela de horas zerada será uma folga
            </label>
          </div>

          <hr className={styles.divider} />

          {/* Horários de referência */}
          <p className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>Horários de referência</p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="lot-100pct">Hora de início para cálculo de 100%</label>
              <input
                id="lot-100pct"
                type="time"
                value={form.hora_inicio_100pct}
                onChange={updateField('hora_inicio_100pct')}
              />
              <p className={styles.hint}>Deixe em branco se não se aplica.</p>
            </div>
            <div className={styles.field}>
              <label htmlFor="lot-noturno">Hora de início para adicional noturno</label>
              <input
                id="lot-noturno"
                type="time"
                value={form.hora_inicio_adicional_noturno}
                onChange={updateField('hora_inicio_adicional_noturno')}
              />
            </div>
            {editingId != null ? (
              <div className={styles.field}>
                <label htmlFor="lot-ativo">Situação</label>
                <select id="lot-ativo" value={form.ativo} onChange={updateField('ativo')}>
                  <option value="1">Ativa</option>
                  <option value="0">Inativa</option>
                </select>
              </div>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Salvando…' : editingId != null ? 'Salvar alterações' : 'Cadastrar lotação'}
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
        <h2 className={styles.sectionTitle}>Lotações cadastradas</h2>
        {loadingLista ? (
          <p className={styles.loading}>Carregando lista…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Colaboradores</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={4}>Nenhuma lotação cadastrada ainda.</td>
                  </tr>
                ) : (
                  lista.map((l) => (
                    <tr key={l.id}>
                      <td>{l.nome}</td>
                      <td>{l.total_funcionarios ?? 0}</td>
                      <td>
                        {l.ativo === 0
                          ? <span className={`${styles.badge} ${styles.badgeOff}`}>Inativa</span>
                          : <span className={styles.badge}>Ativa</span>
                        }
                      </td>
                      <td>
                        <button type="button" className={styles.btnLink} onClick={() => iniciarEdicao(l)}>
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
