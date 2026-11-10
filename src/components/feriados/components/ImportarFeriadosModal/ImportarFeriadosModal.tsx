import { useState } from 'react'
import { X } from 'lucide-react'
import { ApiError } from '../../../../lib/api'
import { baixarModelo, importarArquivo, type ImportErro, type ImportResultado } from '../../../../services/importApi'
import { fetchFeriadosNacionaisApi, importarFeriadoNacionalApi, type FeriadoNacionalApiItem } from '../../../../services/feriadosApi'
import styles from './ImportarFeriadosModal.module.css'

interface ImportarFeriadosModalProps {
  onClose: () => void
  onImportado: () => void
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

function formatDataBr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const ANO_ATUAL = new Date().getFullYear()

export function ImportarFeriadosModal({ onClose, onImportado }: ImportarFeriadosModalProps) {
  // ── Feriados nacionais via API ──
  const [ano, setAno] = useState(ANO_ATUAL)
  const [buscando, setBuscando] = useState(false)
  const [lista, setLista] = useState<FeriadoNacionalApiItem[] | null>(null)
  const [erroApi, setErroApi] = useState<string | null>(null)
  const [importandoData, setImportandoData] = useState<string | null>(null)
  const [importadas, setImportadas] = useState<Set<string>>(new Set())

  // ── Planilha ──
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroPlanilha, setErroPlanilha] = useState<string | null>(null)
  const [erros, setErros] = useState<ImportErro[] | null>(null)
  const [resultadoPlanilha, setResultadoPlanilha] = useState<ImportResultado | null>(null)

  async function handleBuscar() {
    setBuscando(true)
    setErroApi(null)
    setLista(null)
    setImportadas(new Set())
    try {
      const r = await fetchFeriadosNacionaisApi(ano)
      setLista(r)
    } catch (e) {
      setErroApi(errMsg(e, 'Não foi possível buscar os feriados nacionais.'))
    } finally {
      setBuscando(false)
    }
  }

  async function handleImportarItem(item: FeriadoNacionalApiItem) {
    setImportandoData(item.data)
    setErroApi(null)
    try {
      await importarFeriadoNacionalApi({ data: item.data, nome: item.nome })
      setImportadas((prev) => new Set(prev).add(item.data))
      onImportado()
    } catch (e) {
      setErroApi(errMsg(e, `Não foi possível importar "${item.nome}".`))
    } finally {
      setImportandoData(null)
    }
  }

  async function handleBaixarModelo() {
    setBaixando(true)
    setErroPlanilha(null)
    try {
      await baixarModelo('feriados')
    } catch {
      setErroPlanilha('Erro ao baixar o modelo. Tente novamente.')
    } finally {
      setBaixando(false)
    }
  }

  async function handleImportarPlanilha() {
    if (!arquivo) return
    setEnviando(true)
    setErroPlanilha(null)
    setErros(null)
    setResultadoPlanilha(null)
    try {
      const res = await importarArquivo('feriados', arquivo)
      setResultadoPlanilha(res)
      if (res.importados > 0) onImportado()
    } catch (err) {
      const corpo = err instanceof ApiError ? (err.body as { erros?: ImportErro[] } | undefined) : undefined
      if (corpo?.erros && Array.isArray(corpo.erros)) {
        setErros(corpo.erros)
      } else {
        setErroPlanilha(errMsg(err, 'Erro ao importar o arquivo.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Importar Feriados</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* ── Feriados nacionais via API ── */}
        <section className={styles.section}>
          <p className={styles.sectionTitle}>1. Feriados nacionais (BrasilAPI)</p>
          <p className={styles.hint}>
            Busca os feriados nacionais do ano — já vem com Carnaval, Sexta-Feira Santa e Corpus Christi
            calculados. Escolha quais importar, um de cada vez.
          </p>
          <div className={styles.row}>
            <input
              type="number"
              className={styles.anoInput}
              value={ano}
              min={2000}
              max={2100}
              onChange={(e) => setAno(Number(e.target.value))}
            />
            <button type="button" className={styles.btnPrimary} onClick={() => void handleBuscar()} disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar feriados'}
            </button>
          </div>
          {erroApi && <p className={styles.error} role="alert">{erroApi}</p>}

          {lista && (
            <table className={styles.listaTable}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>Recorrente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => {
                  const jaCadastrado = item.ja_existe || importadas.has(item.data)
                  const carregando = importandoData === item.data
                  return (
                    <tr key={item.data}>
                      <td>{formatDataBr(item.data)}</td>
                      <td>{item.nome}</td>
                      <td>{item.recorrente ? 'Sim' : 'Não'}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnRowImportar}
                          onClick={() => void handleImportarItem(item)}
                          disabled={jaCadastrado || carregando}
                        >
                          {jaCadastrado ? 'Já cadastrado' : carregando ? '…' : 'Importar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <hr className={styles.divider} />

        {/* ── Planilha ── */}
        <section className={styles.section}>
          <p className={styles.sectionTitle}>2. Outros feriados (planilha Excel)</p>
          <p className={styles.hint}>
            Para feriados estaduais, municipais ou próprios da empresa — baixe o modelo, preencha e envie.
          </p>

          <div className={styles.row}>
            <button type="button" className={styles.btnSecundario} onClick={() => void handleBaixarModelo()} disabled={baixando}>
              {baixando ? 'Baixando…' : 'Baixar modelo (.xlsx)'}
            </button>
          </div>

          <div className={styles.field}>
            <label htmlFor="feriados-arquivo">Planilha preenchida</label>
            <input
              id="feriados-arquivo"
              type="file"
              accept=".xlsx"
              onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErros(null); setErroPlanilha(null); setResultadoPlanilha(null) }}
            />
          </div>

          {erroPlanilha && <p className={styles.error} role="alert">{erroPlanilha}</p>}

          {erros && (
            <div>
              <p className={styles.error}>{erros.length} linha(s) com problema — corrija a planilha e envie novamente.</p>
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

          {resultadoPlanilha && (
            <p className={styles.success} role="status">
              {resultadoPlanilha.importados} feriado(s) importado(s) com sucesso.
            </p>
          )}

          <div className={styles.row}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void handleImportarPlanilha()}
              disabled={!arquivo || enviando}
            >
              {enviando ? 'Importando…' : 'Importar planilha'}
            </button>
          </div>
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
