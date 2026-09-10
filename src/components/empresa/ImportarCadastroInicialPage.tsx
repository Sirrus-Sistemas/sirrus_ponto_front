import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import {
  baixarModelo,
  importarArquivo,
  type ImportEntidade,
  type ImportErro,
  type ImportResultado,
} from '../../services/importApi'
import styles from './ImportarCadastroInicialPage.module.css'

type StepMeta = {
  entidade: ImportEntidade
  titulo: string
  descricao: string
}

const STEPS: StepMeta[] = [
  {
    entidade: 'lotacoes',
    titulo: 'Lotações',
    descricao: 'Informe o nome de cada lotação. As regras de cálculo de cada uma ficam no padrão do sistema — ajuste depois em Lotações, se precisar.',
  },
  {
    entidade: 'turnos',
    titulo: 'Tabela de Horários',
    descricao: 'Informe o horário base de cada tabela de horários (entrada, intervalo e saída).',
  },
  {
    entidade: 'funcionarios',
    titulo: 'Funcionários',
    descricao: 'Informe os dados de cada funcionário. Lotação e Tabela de Horários devem ter o mesmo nome cadastrado nos passos anteriores.',
  },
]

function mensagemSucesso(entidade: ImportEntidade, n: number): string {
  if (entidade === 'lotacoes') return `${n} lotação(ões) importada(s) com sucesso.`
  if (entidade === 'turnos') return `${n} tabela(s) de horários importada(s) com sucesso.`
  return `${n} funcionário(s) importado(s) com sucesso.`
}

export function ImportarCadastroInicialPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const navigate = useNavigate()

  const [stepIndex, setStepIndex] = useState(0)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [erros, setErros] = useState<ImportErro[] | null>(null)
  const [resultado, setResultado] = useState<ImportResultado | null>(null)

  const step = STEPS[stepIndex]
  const ultimoPasso = stepIndex === STEPS.length - 1

  function limparResultadoDoPasso() {
    setArquivo(null)
    setErroGeral(null)
    setErros(null)
    setResultado(null)
  }

  async function handleBaixarModelo() {
    setBaixando(true)
    setErroGeral(null)
    try {
      await baixarModelo(step.entidade)
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
      const res = await importarArquivo(step.entidade, arquivo)
      setResultado(res)
    } catch (err) {
      const corpo = err instanceof ApiError ? (err.body as { erros?: ImportErro[] } | undefined) : undefined
      if (corpo?.erros && Array.isArray(corpo.erros)) {
        setErros(corpo.erros)
      } else {
        setErroGeral(err instanceof ApiError ? err.message : 'Erro ao importar o arquivo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  function handleContinuar() {
    if (ultimoPasso) {
      navigate('/configuracoes/empresa')
      return
    }
    setStepIndex((i) => i + 1)
    limparResultadoDoPasso()
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
      <h1 className={styles.title}>Importar cadastro inicial</h1>
      <p className={styles.subtitle}>
        Assistente em 3 passos para popular lotações, tabela de horários e funcionários a partir de
        uma planilha — disponível só nesta primeira configuração. Depois de concluído, o cadastro
        segue pelas telas normais de cada um.
      </p>

      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li
            key={s.entidade}
            className={`${styles.step} ${i === stepIndex ? styles.stepAtivo : ''} ${i < stepIndex ? styles.stepConcluido : ''}`}
          >
            <span className={styles.stepNumero}>{i < stepIndex ? '✓' : i + 1}</span>
            <span>{s.titulo}</span>
          </li>
        ))}
      </ol>

      <div className={styles.card}>
        <p className={styles.sectionTitle}>{stepIndex + 1}. {step.titulo}</p>
        <p className={styles.hint}>{step.descricao}</p>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.btnSecundario} onClick={() => void handleBaixarModelo()} disabled={baixando}>
            {baixando ? 'Baixando…' : 'Baixar modelo (.xlsx)'}
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor="arquivo-import">Planilha preenchida</label>
          <input
            id="arquivo-import"
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
          <div>
            <p className={`${styles.feedback} ${styles.feedbackOk}`}>
              {mensagemSucesso(step.entidade, resultado.importados)}
            </p>
            {resultado.funcionarios && resultado.funcionarios.length > 0 && (
              <div>
                <p className={styles.hint}>
                  Senhas iniciais geradas (comunique aos funcionários — cada um pode trocar depois do primeiro acesso):
                </p>
                <table className={styles.errosTable}>
                  <thead>
                    <tr><th>Nome</th><th>CPF</th><th>Senha inicial</th></tr>
                  </thead>
                  <tbody>
                    {resultado.funcionarios.map((f) => (
                      <tr key={f.cpf}>
                        <td>{f.nome}</td>
                        <td>{f.cpf}</td>
                        <td>{f.senha_inicial}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
            <button type="button" className={styles.btnPrimary} onClick={handleContinuar}>
              {ultimoPasso ? 'Concluir' : 'Continuar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
