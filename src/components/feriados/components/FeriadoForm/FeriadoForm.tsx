import { useState } from 'react'
import type { TipoFeriado, FeriadoPayload } from '../../types'
import { ApiError } from '../../../../lib/api'
import { UFS } from '../../data'
import { Segmented } from '../ui/Segmented'
import styles from './FeriadoForm.module.css'

interface FormState {
  nome: string
  tipo: TipoFeriado
  uf: string
  dia: number
  mes: number
  ano: number
  recorrente: boolean
  observacao: string
}

const ANO_ATUAL = new Date().getFullYear()

const INITIAL: FormState = {
  nome: '',
  tipo: 'nacional',
  uf: '',
  dia: 1,
  mes: 1,
  ano: ANO_ATUAL,
  recorrente: true,
  observacao: '',
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const ANOS_FORM = Array.from({ length: 7 }, (_, i) => ANO_ATUAL - 1 + i)
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

const RECORRENCIA_OPTS = [
  { value: 'true',  label: 'Repete todo ano' },
  { value: 'false', label: 'Apenas este ano' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

interface FeriadoFormProps {
  onSubmit: (payload: FeriadoPayload) => Promise<void>
}

export function FeriadoForm({ onSubmit }: FeriadoFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showUF = form.tipo === 'estadual' || form.tipo === 'municipal'

  const isValid =
    form.nome.trim() !== '' &&
    (showUF ? form.uf !== '' : true)

  function handleTipoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((f) => ({ ...f, tipo: e.target.value as TipoFeriado, uf: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(null)

    const data = form.recorrente
      ? `${pad(form.mes)}-${pad(form.dia)}`
      : `${form.ano}-${pad(form.mes)}-${pad(form.dia)}`

    try {
      await onSubmit({
        nome:       form.nome.trim(),
        tipo:       form.tipo,
        data,
        recorrente: form.recorrente,
        uf:         form.uf || null,
        observacao: form.observacao.trim() || null,
      })
      setForm(INITIAL)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar o feriado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.iconBox}><CalendarIcon /></div>
        <div>
          <div className={styles.cardTitle}>Novo feriado</div>
          <div className={styles.cardDesc}>Entra automaticamente no cálculo de escalas</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <p className={styles.formError} role="alert">{error}</p>
        )}

        {/* Nome */}
        <div className={styles.field}>
          <label htmlFor="fer-nome" className={styles.label}>Nome do feriado</label>
          <input
            id="fer-nome"
            className={styles.input}
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex.: Natal, Tiradentes, Aniversário da cidade…"
            autoComplete="off"
          />
        </div>

        {/* Tipo */}
        <div className={styles.field}>
          <label htmlFor="fer-tipo" className={styles.label}>Tipo</label>
          <select
            id="fer-tipo"
            className={styles.select}
            value={form.tipo}
            onChange={handleTipoChange}
          >
            <option value="nacional">Nacional</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
            <option value="empresa">Empresarial</option>
          </select>
        </div>

        {/* UF (estadual ou municipal) */}
        {showUF && (
          <div className={styles.field}>
            <label htmlFor="fer-uf" className={styles.label}>UF</label>
            <select
              id="fer-uf"
              className={styles.select}
              value={form.uf}
              onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
            >
              <option value="">Selecione a UF…</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        )}

        {/* Data */}
        <div className={styles.field}>
          <label className={styles.label}>Data</label>
          <div className={styles.dateRow}>
            <select
              aria-label="Dia"
              className={`${styles.select} ${styles.selectDia}`}
              value={form.dia}
              onChange={(e) => setForm((f) => ({ ...f, dia: Number(e.target.value) }))}
            >
              {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              aria-label="Mês"
              className={`${styles.select} ${styles.selectMes}`}
              value={form.mes}
              onChange={(e) => setForm((f) => ({ ...f, mes: Number(e.target.value) }))}
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            {!form.recorrente && (
              <select
                aria-label="Ano"
                className={`${styles.select} ${styles.selectAno}`}
                value={form.ano}
                onChange={(e) => setForm((f) => ({ ...f, ano: Number(e.target.value) }))}
              >
                {ANOS_FORM.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Recorrência */}
        <div className={styles.field}>
          <label className={styles.label}>Recorrência</label>
          <Segmented
            options={RECORRENCIA_OPTS}
            value={String(form.recorrente)}
            onChange={(val) => setForm((f) => ({ ...f, recorrente: val === 'true' }))}
          />
        </div>

        {/* Observação */}
        <div className={styles.field}>
          <label htmlFor="fer-obs" className={styles.label}>
            Observação <span className={styles.opcional}>(opcional)</span>
          </label>
          <textarea
            id="fer-obs"
            className={styles.textarea}
            rows={2}
            value={form.observacao}
            onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            placeholder="Informações adicionais sobre o feriado…"
          />
        </div>

        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={!isValid || submitting}
        >
          <PlusIcon />
          {submitting ? 'Cadastrando…' : 'Cadastrar feriado'}
        </button>
      </form>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
