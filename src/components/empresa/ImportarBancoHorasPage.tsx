import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { baixarModelo, importarArquivo, type ImportErro, type ImportResultado } from '../../services/importApi'
import { fetchPodeImportarBancoHoras } from '../../services/bancoHorasApi'
import styles from './ImportarCadastroInicialPage.module.css'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

export function ImportarBancoHorasPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const navigate = useNavigate()

  const [checando, setChecando] = useState(true)
  const [podeImportar, setPodeImportar] = useState(false)

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [erros, setErros] = useState<ImportErro[] | null>(null)
  const [resultado, setResultado] = useState<ImportResultado | null>(null)

  useEffect(() => {
    fetchPodeImportarBancoHoras()
      .then(setPodeImportar)
      .catch(() => setPodeImportar(false))
      .finally(() => setChecando(false))
  }, [])

  async function handleBaixarModelo() {
    setBaixando(true)
    setErroGeral(null)
    try {
      await baixarModelo('banco_horas')
    } catch {
      setErroGeral('Erro ao baixar o modelo. Tente novamente.')
    } finally {
      setBaixando(false)
    }
  }

  async function handleImportar() {
    if (!arquivo) return
    setEnviando(true)
    setErroGeral(null)
    setErros(null)
    setResultado(null)
    try {
      const res = await importarArquivo('banco_horas', arquivo)
      setResultado(res)
    } catch (err) {
      const corpo = err instanceof ApiError ? (err.body as { erros?: ImportErro[] } | undefined) : undefined
      if (corpo?.erros && Array.isArray(corpo.erros)) {
        setErros(corpo.erros)
      } else {
        setErroGeral(errMsg(err, 'Erro ao importar o arquivo.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (!meReady || checando) return <p className={styles.loading}>Carregando…</p>

  if (!me || me.role !== 'admin') {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Acesso restrito</h2>
        <p><Link to="/dashboard">Voltar</Link></p>
      </div>
    )
  }

  if (!podeImportar) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Importar banco de horas</h1>
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Import não disponível</p>
          <p className={styles.hint}>
            Esta empresa já tem lançamentos no banco de horas — o import do Sirrus Ponto Velox só é
            permitido uma única vez, antes do primeiro lançamento, pra não duplicar ou misturar histórico.
          </p>
          <div className={styles.actions}>
            <Link to="/banco-horas" className={styles.btnPrimary} style={{ textDecoration: 'none', display: 'inline-block' }}>
              Ir para Banco de Horas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Importar banco de horas</h1>
      <p className={styles.subtitle}>
        Migração única do saldo de banco de horas do Sirrus Ponto Velox — disponível só enquanto
        esta empresa não tiver nenhum lançamento no sistema web. Depois de importado, os lançamentos
        seguem pela tela normal de Banco de Horas.
      </p>

      <div className={styles.card}>
        <p className={styles.sectionTitle}>Planilha de banco de horas</p>
        <p className={styles.hint}>
          Pode subir direto o arquivo exportado pelo Sirrus Ponto Velox ("Exportar Banco de Horas", na tela
          de Exportar Cadastro) — mesma ordem de colunas, sem precisar reformatar. O CPF de cada linha
          precisa já estar cadastrado em Funcionários.
        </p>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.btnSecundario} onClick={() => void handleBaixarModelo()} disabled={baixando}>
            {baixando ? 'Baixando…' : 'Baixar modelo (.xlsx)'}
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor="arquivo-import-bh">Planilha preenchida</label>
          <input
            id="arquivo-import-bh"
            type="file"
            accept=".xlsx"
            onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErros(null); setErroGeral(null); setResultado(null) }}
          />
        </div>

        {erroGeral && <p className={`${styles.feedback} ${styles.feedbackError}`}>{erroGeral}</p>}

        {erros && (
          <div className={styles.erros}>
            <p className={`${styles.feedback} ${styles.feedbackError}`}>
              {erros.length} linha(s) com problema — corrija a planilha e envie novamente.
            </p>
            <table className={styles.errosTable}>
              <thead>
                <tr><th>Linha</th><th>Campo</th><th>Erro</th></tr>
              </thead>
              <tbody>
                {erros.map((e, i) => (
                  <tr key={i}>
                    <td>{e.linha}</td>
                    <td>{e.campo}</td>
                    <td>{e.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {resultado && (
          <p className={`${styles.feedback} ${styles.feedbackOk}`}>
            {resultado.importados} lançamento(s) importado(s) com sucesso.
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void handleImportar()}
            disabled={!arquivo || enviando}
          >
            {enviando ? 'Importando…' : 'Importar'}
          </button>
          {resultado && (
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/configuracoes/empresa')}>
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
