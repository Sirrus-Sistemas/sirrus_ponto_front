import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../lib/api'
import { formatHoraLocalPtBr } from '../../lib/parseDataHora'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchMe, type FuncionarioMe } from '../../services/userApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import {
  fetchFicha,
  lancarBatida,
  editarBatida,
  excluirBatida,
  type MarcacaoFicha,
  type DiaFicha,
  type FichaPayload,
} from '../../services/fichaPontoApi'
import styles from './FichaPontoPage.module.css'

// ── helpers ──────────────────────────────────────────────────────────────────

function nowYm() {
  const d = new Date()
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

function labelMes(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function diaSemanaLabel(dateStr: string) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return DIAS_SEMANA[new Date(y, mo - 1, d).getDay()]
}

function horaLocal(iso: string) {
  return formatHoraLocalPtBr(iso)
}

/** Returns sorted slots array (max 8). Null = empty. */
function buildSlots(marcacoes: MarcacaoFicha[]): (MarcacaoFicha | null)[] {
  const sorted = [...marcacoes].sort((a, b) => a.data_hora.localeCompare(b.data_hora))
  const slots: (MarcacaoFicha | null)[] = Array(8).fill(null)
  sorted.slice(0, 8).forEach((m, i) => { slots[i] = m })
  return slots
}

/** ISO UTC → "YYYY-MM-DDTHH:MM" in local time (for datetime-local input) */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${mi}`
}

/** "YYYY-MM-DDTHH:MM" (local) → "YYYY-MM-DD HH:MM:SS" in UTC for API */
function fromDatetimeLocal(val: string): string {
  const d = new Date(val) // parsed as local time by the browser
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${mi}:00`
}

// ── Types for modal ───────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'closed' }
  | { mode: 'add'; data: string; slotIndex: number; funcionarioId: number }
  | { mode: 'edit'; marcacao: MarcacaoFicha }

// ── Component ─────────────────────────────────────────────────────────────────

export function FichaPontoPage() {
  const initial = useMemo(() => nowYm(), [])
  const [ano, setAno] = useState(initial.ano)
  const [mes, setMes] = useState(initial.mes)
  const [ficha, setFicha] = useState<FichaPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [me, setMe] = useState<FuncionarioMe | null>(null)
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])
  const [selectedFuncId, setSelectedFuncId] = useState<number | null>(null)
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [selectedLotacaoId, setSelectedLotacaoId] = useState<number | null>(null)

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [modalDatetime, setModalDatetime] = useState('')
  const [modalMotivo, setModalMotivo] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const podeEditar = me?.role === 'admin' || me?.role === 'gestor'

  const anos = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, i) => y - 3 + i)
  }, [])

  const meses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: labelMes(i + 1),
      })),
    [],
  )

  const funcionariosFiltrados = useMemo(() => {
    if (!selectedLotacaoId) return funcionarios
    return funcionarios.filter((f) => f.lotacao_id === selectedLotacaoId)
  }, [funcionarios, selectedLotacaoId])

  useEffect(() => {
    fetchMe()
      .then((m) => {
        setMe(m)
        if (m.role === 'admin' || m.role === 'gestor') {
          return Promise.all([
            fetchFuncionarios({ limit: 500, ativo: 1 }),
            fetchLotacoes(),
          ])
        }
      })
      .then((res) => {
        if (res) {
          setFuncionarios(res[0].data)
          setLotacoes(res[1])
        }
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const funcId = selectedFuncId ?? undefined
      const payload = await fetchFicha(ano, mes, funcId)
      setFicha(payload)
    } catch (e) {
      setFicha(null)
      setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a ficha.')
    } finally {
      setLoading(false)
    }
  }, [ano, mes, selectedFuncId])

  useEffect(() => {
    void load()
  }, [load])

  // ── Modal helpers ───────────────────────────────────────────────────────────

  function openAdd(dia: DiaFicha, slotIndex: number) {
    const targetFuncId = selectedFuncId ?? (me?.id ?? 0)
    setModal({ mode: 'add', data: dia.data, slotIndex, funcionarioId: targetFuncId })

    // For overnight workers, use the last punch's local calendar date as the starting
    // point — so a row grouping 19:00/22:00/00:30 correctly pre-fills May 8 for the
    // next punch instead of May 7 (the shift day).
    let prefillDate = dia.data
    if (dia.marcacoes.length > 0) {
      const lastPunch = [...dia.marcacoes].sort(
        (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
      ).at(-1)!
      const lastLocal = new Date(lastPunch.data_hora)
      const y = lastLocal.getFullYear()
      const m = String(lastLocal.getMonth() + 1).padStart(2, '0')
      const d = String(lastLocal.getDate()).padStart(2, '0')
      prefillDate = `${y}-${m}-${d}`
    }

    setModalDatetime(`${prefillDate}T00:00`)
    setModalMotivo('ESQUECIMENTO')
    setModalError(null)
  }

  function openEdit(marcacao: MarcacaoFicha) {
    setModal({ mode: 'edit', marcacao })
    setModalDatetime(toDatetimeLocal(marcacao.data_hora))
    setModalMotivo(marcacao.motivo_edicao ?? 'ESQUECIMENTO')
    setModalError(null)
  }

  function closeModal() {
    setModal({ mode: 'closed' })
    setModalSaving(false)
    setModalError(null)
  }

  async function saveModal() {
    if (!modalDatetime) {
      setModalError('Informe a data e hora.')
      return
    }
    setModalSaving(true)
    setModalError(null)
    try {
      if (modal.mode === 'add') {
        await lancarBatida({
          funcionario_id: modal.funcionarioId,
          data_hora: fromDatetimeLocal(modalDatetime),
          motivo: modalMotivo || undefined,
        })
      } else if (modal.mode === 'edit') {
        await editarBatida(modal.marcacao.id, {
          data_hora: fromDatetimeLocal(modalDatetime),
          motivo: modalMotivo || undefined,
        })
      }
      closeModal()
      void load()
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : 'Erro ao salvar.')
    } finally {
      setModalSaving(false)
    }
  }

  async function confirmDelete() {
    if (confirmDeleteId == null) return
    setDeleting(true)
    try {
      await excluirBatida(confirmDeleteId)
      setConfirmDeleteId(null)
      void load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao excluir.')
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const nomePeriodo = ficha
    ? `${ficha.funcionario.nome} — ${labelMes(mes)} de ${ano}`
    : `${labelMes(mes)} de ${ano}`

  return (
    <div className={styles.wrap}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Ficha de Ponto</h1>
          <p className={styles.subtitle}>{nomePeriodo}</p>
        </div>
        <div className={styles.controls}>
          {podeEditar && funcionarios.length > 0 && (
            <>
              {lotacoes.length > 0 && (
                <div className={styles.field}>
                  <label htmlFor="ficha-lotacao">Lotação</label>
                  <select
                    id="ficha-lotacao"
                    value={selectedLotacaoId ?? ''}
                    onChange={(e) => {
                      setSelectedLotacaoId(e.target.value === '' ? null : Number(e.target.value))
                      setSelectedFuncId(null)
                    }}
                  >
                    <option value="">Todas</option>
                    {lotacoes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="ficha-func">Funcionário</label>
                <select
                  id="ficha-func"
                  value={selectedFuncId ?? ''}
                  onChange={(e) =>
                    setSelectedFuncId(e.target.value === '' ? null : Number(e.target.value))
                  }
                >
                  <option value="">Meu ponto</option>
                  {funcionariosFiltrados.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className={styles.field}>
            <label htmlFor="ficha-mes">Mês</label>
            <select id="ficha-mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {meses.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="ficha-ano">Ano</label>
            <select id="ficha-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={styles.btnImprimir} onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.errorMsg} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.loadingMsg}>Carregando…</p>
      ) : ficha ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thDia}>Data</th>
                <th className={styles.thDsem}>Dia</th>
                <th>Entrada 1</th>
                <th>Saída 1</th>
                <th>Entrada 2</th>
                <th>Saída 2</th>
                <th>Entrada 3</th>
                <th>Saída 3</th>
                <th>Entrada 4</th>
                <th>Saída 4</th>
                {podeEditar ? <th className={styles.thAcao} /> : null}
              </tr>
            </thead>
            <tbody>
              {buildMonthDays(ficha.ano, ficha.mes).map((dateStr) => {
                const dia = ficha.dias.find((d) => d.data === dateStr)
                const marcacoes = dia?.marcacoes ?? []
                const slots = buildSlots(marcacoes)
                const dow = new Date(
                  Number(dateStr.slice(0, 4)),
                  Number(dateStr.slice(5, 7)) - 1,
                  Number(dateStr.slice(8, 10)),
                ).getDay()
                const isDom = dow === 0

                return (
                  <tr key={dateStr} className={isDom ? styles.rowDom : undefined}>
                    <td className={styles.tdDia}>
                      {dateStr.slice(8, 10)}/{dateStr.slice(5, 7)}
                    </td>
                    <td className={styles.tdDsem}>{diaSemanaLabel(dateStr)}</td>
                    {slots.map((slot, i) => (
                      <td
                        key={i}
                        className={[
                          styles.tdSlot,
                          slot
                            ? slot.tipo === 'rep'
                              ? styles.slotRep
                              : styles.slotManual
                            : styles.slotEmpty,
                        ].join(' ')}
                      >
                        {slot ? (
                          <div className={styles.slotContent}>
                            <button
                              type="button"
                              className={styles.slotTime}
                              onClick={() => podeEditar && openEdit(slot)}
                              title={
                                podeEditar
                                  ? slot.motivo_edicao
                                    ? `Motivo: ${slot.motivo_edicao}`
                                    : 'Clique para editar'
                                  : undefined
                              }
                              disabled={!podeEditar}
                            >
                              {horaLocal(slot.data_hora)}
                            </button>
                            {podeEditar ? (
                              <button
                                type="button"
                                className={styles.slotDel}
                                title="Excluir"
                                onClick={() => setConfirmDeleteId(slot.id)}
                              >
                                ×
                              </button>
                            ) : null}
                            {slot.motivo_edicao ? (
                              <span className={styles.slotMotivo} title={slot.motivo_edicao}>
                                {slot.motivo_edicao}
                              </span>
                            ) : null}
                          </div>
                        ) : podeEditar ? (
                          <button
                            type="button"
                            className={styles.slotAdd}
                            title={`Adicionar ${i % 2 === 0 ? 'Entrada' : 'Saída'} ${Math.floor(i / 2) + 1}`}
                            onClick={() => openAdd(dia ?? { data: dateStr, marcacoes: [] }, i)}
                          >
                            +
                          </button>
                        ) : (
                          <span className={styles.slotDash}>—</span>
                        )}
                      </td>
                    ))}
                    {podeEditar ? <td /> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className={styles.legenda}>
        <span className={styles.legendaRepDot} /> Batida de REP
        <span className={styles.legendaManualDot} /> Batida manual / justificada
      </p>

      {/* Modal add/edit */}
      {modal.mode !== 'closed' ? (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {modal.mode === 'add' ? 'Adicionar batida' : 'Editar batida'}
            </h2>
            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="modal-dt">
                Data e hora
              </label>
              <input
                id="modal-dt"
                type="datetime-local"
                className={styles.modalInput}
                value={modalDatetime}
                onChange={(e) => setModalDatetime(e.target.value)}
              />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="modal-motivo">
                Motivo
              </label>
              <input
                id="modal-motivo"
                type="text"
                className={styles.modalInput}
                value={modalMotivo}
                onChange={(e) => setModalMotivo(e.target.value)}
                placeholder="Ex.: ESQUECIMENTO"
              />
            </div>
            {modalError ? <p className={styles.modalError}>{modalError}</p> : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSalvar}
                onClick={() => void saveModal()}
                disabled={modalSaving}
              >
                {modalSaving ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" className={styles.btnCancelar} onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm delete */}
      {confirmDeleteId != null ? (
        <div className={styles.modalOverlay} onClick={() => setConfirmDeleteId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Excluir batida</h2>
            <p className={styles.modalBody}>
              Tem certeza que deseja excluir esta batida? Esta ação não pode ser desfeita.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnExcluir}
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
              <button
                type="button"
                className={styles.btnCancelar}
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Returns all date strings "YYYY-MM-DD" for the given month */
function buildMonthDays(ano: number, mes: number): string[] {
  const days: string[] = []
  const daysInMonth = new Date(ano, mes, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(mes).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    days.push(`${ano}-${mm}-${dd}`)
  }
  return days
}
