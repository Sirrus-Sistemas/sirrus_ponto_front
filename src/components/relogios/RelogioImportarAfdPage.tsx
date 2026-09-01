import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchRelogios, importarAfd, type ImportarAfdResumo, type Relogio } from '../../services/relogiosApi'
import styles from './RelogioComunicacaoPage.module.css'

export function RelogioImportarAfdPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [relogios, setRelogios] = useState<Relogio[]>([])
  const [relogioId, setRelogioId] = useState<number | ''>('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<ImportarAfdResumo | null>(null)

  const loadRelogios = useCallback(async () => {
    try {
      setRelogios(await fetchRelogios())
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => { void loadRelogios() }, [loadRelogios])

  async function enviar() {
    if (!relogioId || !arquivo) return
    setEnviando(true)
    setError(null)
    setResumo(null)
    try {
      const dados = await importarAfd(relogioId, arquivo, { dataInicio, dataFim })
      setResumo(dados)
      setArquivo(null)
      setDataInicio('')
      setDataFim('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao importar o arquivo AFD.')
    } finally {
      setEnviando(false)
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me || me.role !== 'admin') {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Acesso restrito</h2>
        <p><Link to="/dashboard">Voltar</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Importar Arquivo AFD</h1>
          <p className={styles.subtitle}>
            Para relógios sem rede — baixe o AFD do equipamento com um pen drive e envie o
            arquivo aqui. As marcações são importadas pelo mesmo processo da coleta automática:
            o que já tiver funcionário correspondente entra direto na ficha de ponto, o resto
            fica pendente de vínculo em <Link to="/relogios/marcacoes-pendentes">Marcações Pendentes</Link>.
          </p>
        </div>
      </div>

      <div className={styles.panelCard}>
        <div className={styles.modalField}>
          <label>RELÓGIO</label>
          <select
            value={relogioId}
            onChange={(e) => setRelogioId(e.target.value ? Number(e.target.value) : '')}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--sp-border)' }}
          >
            <option value="">Selecione…</option>
            {relogios.map((r) => (
              <option key={r.id} value={r.id}>{r.descricao}</option>
            ))}
          </select>
        </div>

        <div className={styles.modalField} style={{ marginTop: '1rem' }}>
          <label>ARQUIVO AFD (.txt)</label>
          <input
            type="file"
            accept=".txt"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div className={styles.modalField}>
            <label>DE (opcional)</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              max={dataFim || undefined}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--sp-border)' }}
            />
          </div>
          <div className={styles.modalField}>
            <label>ATÉ (opcional)</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              min={dataInicio || undefined}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--sp-border)' }}
            />
          </div>
        </div>
        <p className={styles.subtitle} style={{ marginTop: '0.35rem' }}>
          Deixe em branco para importar todo o histórico do arquivo. Preenchendo, só as marcações
          dentro do período selecionado são importadas — o restante do arquivo é ignorado.
        </p>

        {error && <p className={`${styles.feedback} ${styles.feedbackError}`}>{error}</p>}

        {resumo && (
          <p className={`${styles.feedback} ${styles.feedbackOk}`}>
            {resumo.total_linhas} marcação(ões) lida(s) do arquivo — {resumo.inserida} inserida(s),{' '}
            {resumo.pendente} pendente(s) de vínculo, {resumo.duplicada} já existente(s).
          </p>
        )}

        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            className={`${styles.btnAction} ${styles.btnPrimary}`}
            onClick={() => void enviar()}
            disabled={!relogioId || !arquivo || enviando}
          >
            {enviando ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}
