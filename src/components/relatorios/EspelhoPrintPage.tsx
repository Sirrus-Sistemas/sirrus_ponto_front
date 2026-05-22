import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchFuncionarios } from '../../services/funcionariosApi'
import { fetchEspelho, type EspelhoPayload } from '../../services/espelhoApi'
import { EspelhoImpressao } from './EspelhoImpressao'
import styles from './EspelhoPrintPage.module.css'

type Entry = { id: number; espelho: EspelhoPayload }

function labelMes(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

export function EspelhoPrintPage() {
  const [params] = useSearchParams()
  const mes = Number(params.get('mes') ?? new Date().getMonth() + 1)
  const ano = Number(params.get('ano') ?? new Date().getFullYear())
  const escopo = params.get('escopo') ?? 'funcionario'
  const funcIdParam = params.get('func_id')
  const lotacaoIdParam = params.get('lotacao_id')

  const [entries, setEntries] = useState<Entry[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    document.title = `Espelho de Ponto — ${labelMes(mes)} de ${ano}`

    async function load() {
      abortRef.current = false
      setError(null)

      let ids: number[] = []

      try {
        if (escopo === 'funcionario' && funcIdParam) {
          ids = [Number(funcIdParam)]
        } else {
          const lotId = lotacaoIdParam ? Number(lotacaoIdParam) : undefined
          const res = await fetchFuncionarios({ limit: 500, ativo: 1, lotacao_id: lotId })
          ids = res.data.map((f) => f.id)
        }
      } catch {
        setError('Não foi possível carregar a lista de funcionários.')
        return
      }

      if (!ids.length) {
        setError('Nenhum funcionário encontrado.')
        return
      }

      setProgress({ done: 0, total: ids.length })
      const result: Entry[] = []

      for (const id of ids) {
        if (abortRef.current) break
        try {
          const espelho = await fetchEspelho(ano, mes, id)
          result.push({ id, espelho })
        } catch {
          // skip on error
        }
        setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null))
      }

      setProgress(null)
      setEntries(result)
    }

    void load()
    return () => { abortRef.current = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const periodo = `${labelMes(mes)} de ${ano}`

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>
          Espelho de Ponto — {periodo}
          {entries.length > 0 ? ` (${entries.length} funcionário${entries.length !== 1 ? 's' : ''})` : ''}
        </span>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.btnPrint}
            onClick={() => window.print()}
            disabled={entries.length === 0}
          >
            Imprimir / Salvar PDF
          </button>
          <button type="button" className={styles.btnClose} onClick={() => window.close()}>
            Fechar
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : progress !== null ? (
          <div className={styles.loadingWrap}>
            <p className={styles.loadingText}>
              Carregando espelhos… {progress.done}/{progress.total}
            </p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : entries.length === 0 ? (
          <p className={styles.loadingText}>Nenhum dado para exibir.</p>
        ) : (
          entries.map(({ id, espelho }, idx) => (
            <EspelhoImpressao key={id} espelho={espelho} pageNum={idx + 1} inline />
          ))
        )}
      </div>
    </div>
  )
}
