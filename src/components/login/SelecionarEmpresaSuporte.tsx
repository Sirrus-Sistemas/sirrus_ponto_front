import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import {
  suporteBuscarEmpresas,
  suporteEntrarEmpresa,
  type EmpresaSuporte,
} from '../../services/authApi'
import styles from './SelecionarEmpresaSuporte.module.css'

function cnpjMask(v: string | null) {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length !== 14) return v ?? ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Suporte Sirrus: após o login por senha diária, o técnico escolhe a empresa
 * (busca por nome ou CNPJ) antes de entrar.
 */
export function SelecionarEmpresaSuporte({
  suporteToken,
  onEntrou,
  onCancelar,
}: {
  suporteToken: string
  onEntrou: () => void
  onCancelar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [empresas, setEmpresas] = useState<EmpresaSuporte[]>([])
  const [carregando, setCarregando] = useState(false)
  const [entrando, setEntrando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Debounce da busca.
  useEffect(() => {
    let ativo = true
    const t = setTimeout(() => {
      setCarregando(true)
      suporteBuscarEmpresas(suporteToken, busca)
        .then((e) => { if (ativo) setEmpresas(e) })
        .catch((err) => { if (ativo) setErro(err instanceof ApiError ? err.message : 'Erro ao buscar empresas.') })
        .finally(() => { if (ativo) setCarregando(false) })
    }, 300)
    return () => { ativo = false; clearTimeout(t) }
  }, [busca, suporteToken])

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  async function entrar(id: number) {
    setErro(null)
    setEntrando(id)
    try {
      await suporteEntrarEmpresa(suporteToken, id)
      onEntrou()
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar na empresa.')
      setEntrando(null)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Selecionar empresa">
        <div className={styles.header}>
          <h2 className={styles.title}>Suporte Sirrus</h2>
          <p className={styles.subtitle}>Escolha a empresa que você quer acessar.</p>
        </div>

        <input
          ref={inputRef}
          type="search"
          className={styles.busca}
          placeholder="Buscar por nome ou CNPJ…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {erro ? <p className={styles.erro} role="alert">{erro}</p> : null}

        <div className={styles.lista}>
          {carregando && empresas.length === 0 ? (
            <p className={styles.vazio}>Carregando…</p>
          ) : empresas.length === 0 ? (
            <p className={styles.vazio}>Nenhuma empresa encontrada.</p>
          ) : (
            empresas.map((e) => (
              <button
                key={e.id}
                type="button"
                className={styles.item}
                disabled={entrando !== null}
                onClick={() => void entrar(e.id)}
              >
                <span className={styles.itemNome}>
                  {e.razao_social}
                  {e.ativa === 0 ? <span className={styles.inativa}>inativa</span> : null}
                </span>
                <span className={styles.itemCnpj}>{cnpjMask(e.cnpj)}</span>
                {entrando === e.id ? <span className={styles.entrando}>Entrando…</span> : null}
              </button>
            ))
          )}
        </div>

        <button type="button" className={styles.cancelar} onClick={onCancelar} disabled={entrando !== null}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
