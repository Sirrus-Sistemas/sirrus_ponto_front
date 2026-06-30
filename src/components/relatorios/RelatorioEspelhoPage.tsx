import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { fetchEspelho, type EspelhoPayload } from '../../services/espelhoApi'
import { EspelhoImpressao } from './EspelhoImpressao'
import styles from './RelatorioEspelhoPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelMes(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Escopo = 'empresa' | 'lotacao' | 'funcionario'

type EspelhoEntry = {
  funcionario: FuncionarioListItem
  espelho: EspelhoPayload
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function RelatorioEspelhoPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [escopo, setEscopo] = useState<Escopo>('funcionario')
  const [lotacaoId, setLotacaoId] = useState<number | null>(null)
  const [funcId, setFuncId] = useState<number | null>(null)

  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  const [entries, setEntries] = useState<EspelhoEntry[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const ZOOM_STEP = 10
  const ZOOM_MIN = 50
  const ZOOM_MAX = 150
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    fetchLotacoes().then(setLotacoes).catch(() => {})
    fetchFuncionarios({ limit: 500, ativo: 1 })
      .then((r) => setFuncionarios(r.data))
      .catch(() => {})
  }, [])

  const anos = useMemo(() => {
    const y = now.getFullYear()
    return Array.from({ length: 5 }, (_, i) => y - 2 + i)
  }, [])

  const meses = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: labelMes(i + 1) })),
    [],
  )

  const gerar = useCallback(async () => {
    setEntries([])
    setError(null)
    abortRef.current = false

    let lista: FuncionarioListItem[] = []

    if (escopo === 'empresa') {
      lista = funcionarios
    } else if (escopo === 'lotacao') {
      if (!lotacaoId) {
        setError('Selecione uma lotação.')
        return
      }
      lista = funcionarios.filter((f) => f.lotacao_id === lotacaoId)
    } else {
      if (!funcId) {
        setError('Selecione um funcionário.')
        return
      }
      lista = funcionarios.filter((f) => f.id === funcId)
    }

    if (!lista.length) {
      setError('Nenhum funcionário encontrado para o filtro informado.')
      return
    }

    setProgress({ done: 0, total: lista.length })

    const result: EspelhoEntry[] = []
    for (const func of lista) {
      if (abortRef.current) break
      try {
        const espelho = await fetchEspelho(ano, mes, func.id)
        result.push({ funcionario: func, espelho })
      } catch {
        // skip employee on error
      }
      if (!abortRef.current) {
        setProgress((p) => p ? { done: p.done + 1, total: p.total } : null)
      }
    }

    setProgress(null)
    setEntries(result)
  }, [escopo, lotacaoId, funcId, funcionarios, ano, mes])


  return (
    <div className={styles.wrap}>
      {/* ── Formulário de filtros ──────────────────────────────────── */}
      <div className={styles.form}>
        <div className={styles.formTitle}>
          <h1 className={styles.title}>Relatório — Espelho de Ponto</h1>
          <p className={styles.subtitle}>Gere e imprima espelhos por empresa, lotação ou funcionário.</p>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label>Mês</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {meses.map((m) => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Ano</label>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label>Escopo</label>
            <div className={styles.radioGroup}>
              {(['empresa', 'lotacao', 'funcionario'] as Escopo[]).map((s) => (
                <label key={s} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="escopo"
                    value={s}
                    checked={escopo === s}
                    onChange={() => setEscopo(s)}
                  />
                  {s === 'empresa' ? 'Toda a empresa' : s === 'lotacao' ? 'Por lotação' : 'Por funcionário'}
                </label>
              ))}
            </div>
          </div>

          {escopo === 'lotacao' ? (
            <div className={styles.field}>
              <label>Lotação</label>
              <select
                value={lotacaoId ?? ''}
                onChange={(e) => setLotacaoId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione…</option>
                {lotacoes.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          ) : escopo === 'funcionario' ? (
            <div className={styles.field}>
              <label>Funcionário</label>
              <select
                value={funcId ?? ''}
                onChange={(e) => setFuncId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione…</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {error ? <p className={styles.errorMsg}>{error}</p> : null}

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btnGerar}
            onClick={() => void gerar()}
            disabled={progress !== null}
          >
            {progress
              ? `Carregando… ${progress.done}/${progress.total}`
              : 'Gerar relatório'}
          </button>
          {entries.length > 0 ? (
            <>
              <div className={styles.zoomControls}>
                <button
                  type="button"
                  className={styles.btnZoom}
                  onClick={() => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN))}
                  disabled={zoom <= ZOOM_MIN}
                  title="Diminuir zoom"
                >−</button>
                <span className={styles.zoomLabel}>{zoom}%</span>
                <button
                  type="button"
                  className={styles.btnZoom}
                  onClick={() => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX))}
                  disabled={zoom >= ZOOM_MAX}
                  title="Aumentar zoom"
                >+</button>
              </div>
              <button
                type="button"
                className={styles.btnImprimir}
                onClick={() => {
                  const qs = new URLSearchParams({ mes: String(mes), ano: String(ano), escopo })
                  if (escopo === 'lotacao' && lotacaoId) qs.set('lotacao_id', String(lotacaoId))
                  if (escopo === 'funcionario' && funcId) qs.set('func_id', String(funcId))
                  window.open(`/relatorios/espelho/print?${qs.toString()}`, '_blank')
                }}
              >
                Imprimir / PDF
              </button>
            </>
          ) : null}
        </div>

        {progress !== null ? (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* ── Pré-visualização do espelho (tela + impressão) ───────── */}
      {entries.length > 0 ? (
        <div className={styles.previewArea}>
          <div style={{ zoom: `${zoom}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            {entries.map(({ espelho }, idx) => (
              <EspelhoImpressao
                key={espelho.meta.funcionario_id}
                espelho={espelho}
                pageNum={idx + 1}
                inline
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
