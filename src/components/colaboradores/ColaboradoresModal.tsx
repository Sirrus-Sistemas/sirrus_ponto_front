import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import styles from './ColaboradoresModal.module.css'

/** Vínculo cujos colaboradores serão listados (lotação ou tabela de horário/turno). */
export type ColaboradoresFiltro = { lotacao_id: number } | { turno_id: number }

interface ColaboradoresModalProps {
  filtro: ColaboradoresFiltro
  /** Nome da lotação/turno, exibido abaixo do título. */
  nome: string
  onClose: () => void
}

function formatCpf(cpf: string | null): string {
  const d = String(cpf ?? '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (cpf ?? '—')
}

/** Lista os colaboradores ativos de uma lotação ou turno (mesmo critério dos contadores das telas). */
export function ColaboradoresModal({ filtro, nome, onClose }: ColaboradoresModalProps) {
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const lotacaoId = 'lotacao_id' in filtro ? filtro.lotacao_id : undefined
  const turnoId = 'turno_id' in filtro ? filtro.turno_id : undefined

  useEffect(() => {
    const ctrl = new AbortController()
    fetchFuncionarios({ lotacao_id: lotacaoId, turno_id: turnoId, ativo: 1, limit: 10000 }, ctrl.signal)
      .then((r) => setFuncionarios([...r.data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))))
      .catch((e) => {
        if (ctrl.signal.aborted) return
        setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar os colaboradores.')
      })
    return () => ctrl.abort()
  }, [lotacaoId, turnoId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const termo = busca.trim().toLowerCase()
  const termoDigitos = termo.replace(/\D/g, '')
  const filtrados = (funcionarios ?? []).filter((f) =>
    !termo ||
    f.nome.toLowerCase().includes(termo) ||
    (termoDigitos !== '' && String(f.cpf ?? '').replace(/\D/g, '').includes(termoDigitos)) ||
    String(f.matricula ?? '').toLowerCase().includes(termo),
  )

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="lot-func-titulo">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="lot-func-titulo" className={styles.modalTitle}>Colaboradores</h2>
            <p className={styles.modalSub}>
              {nome}
              {funcionarios && ` · ${funcionarios.length} ativo${funcionarios.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        {funcionarios && funcionarios.length > 0 && (
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Buscar por nome, CPF ou matrícula…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />
        )}

        {erro ? (
          <p className={styles.error} role="alert">{erro}</p>
        ) : funcionarios === null ? (
          <p className={styles.info}>Carregando…</p>
        ) : funcionarios.length === 0 ? (
          <p className={styles.info}>Nenhum colaborador ativo vinculado.</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.info}>Nenhum colaborador encontrado para “{busca}”.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Matrícula</th>
                  <th>Cargo</th>
                  <th>Filial</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id}>
                    <td className={styles.nome}>{f.nome}</td>
                    <td className={styles.mono}>{formatCpf(f.cpf)}</td>
                    <td>{f.matricula || '—'}</td>
                    <td>{f.cargo || '—'}</td>
                    <td>{f.filial_nome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
