import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchMobileFiliais, type FilialMobileItem } from '../../services/mobileApi'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { TURNO_LABELS } from '../../services/ocorrenciasApi'
import {
  fetchOcorrenciasPendentesMobile,
  negarOcorrenciaMobile,
  abrirAnexoOcorrenciaMobile,
  type OcorrenciaPendente,
} from '../../services/ocorrenciasMobileApi'
import { AprovarOcorrenciaModal } from './AprovarOcorrenciaModal'
import styles from './AprovacaoOcorrenciasPage.module.css'

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

function formatPeriodo(inicio: string, fim: string): string {
  const fmt = (d: string) => {
    const [y, m, dd] = d.split('-')
    return `${dd}/${m}/${y}`
  }
  return inicio === fim ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fim)}`
}

export function AprovacaoOcorrenciasPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [filiais, setFiliais] = useState<FilialMobileItem[]>([])
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  const [filialId, setFilialId] = useState<number | ''>('')
  const [lotacaoId, setLotacaoId] = useState<number | ''>('')
  const [funcionarioId, setFuncionarioId] = useState<number | ''>('')

  const [pendentes, setPendentes] = useState<OcorrenciaPendente[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const [rowLoadingId, setRowLoadingId] = useState<number | null>(null)
  const [aprovando, setAprovando] = useState<OcorrenciaPendente | null>(null)

  useEffect(() => {
    fetchMobileFiliais().then(setFiliais).catch(() => {})
    fetchLotacoes().then(setLotacoes).catch(() => {})
  }, [])

  useEffect(() => {
    setFuncionarioId('')
    if (!filialId) { setFuncionarios([]); return }
    fetchFuncionarios({ limit: 1000, ativo: 1, controla_ponto: 1, filial_id: filialId, lotacao_id: lotacaoId || undefined })
      .then((r) => setFuncionarios(r.data))
      .catch(() => {})
  }, [filialId, lotacaoId])

  async function handleBuscar() {
    if (!filialId) return
    setLoading(true)
    setError(null)
    setMensagem(null)
    try {
      const r = await fetchOcorrenciasPendentesMobile({
        filialId,
        lotacaoId: lotacaoId || undefined,
        funcionarioId: funcionarioId || undefined,
      })
      setPendentes(r)
    } catch (e) {
      setError(errMsg(e, 'Erro ao buscar ocorrências pendentes.'))
      setPendentes([])
    } finally {
      setLoading(false)
    }
  }

  async function handleNegar(item: OcorrenciaPendente) {
    if (!confirm(`Negar a ocorrência de ${item.funcionario_nome}?`)) return
    setRowLoadingId(item.mobile_id)
    setError(null)
    try {
      await negarOcorrenciaMobile(item.mobile_id)
      setPendentes((prev) => prev.filter((p) => p.mobile_id !== item.mobile_id))
      setMensagem('Ocorrência negada.')
    } catch (e) {
      setError(errMsg(e, 'Erro ao negar ocorrência.'))
    } finally {
      setRowLoadingId(null)
    }
  }

  function handleAbrirAnexo(item: OcorrenciaPendente) {
    abrirAnexoOcorrenciaMobile(item.mobile_id).catch((e) => setError(errMsg(e, 'Não foi possível abrir o anexo.')))
  }

  function handleAprovacaoConcluida() {
    if (!aprovando) return
    setPendentes((prev) => prev.filter((p) => p.mobile_id !== aprovando.mobile_id))
    setMensagem('Ocorrência aprovada e lançada no Espelho de Ponto.')
    setAprovando(null)
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>
  if (me?.role !== 'admin') {
    return <p className={styles.denied}>Acesso restrito a administradores.</p>
  }

  const filiaisSincronizadas = filiais.filter((f) => f.pontomobile_id)

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Aprovação de Ocorrências</h1>
          <p className={styles.subtitle}>
            Revise as ocorrências (atestados, justificativas…) enviadas pelo app mobile — ao aprovar, classifique
            como Tipo de Ocorrência pra entrar no cálculo do Espelho de Ponto.
          </p>
        </div>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.fieldDark}>
          <label>FILIAL</label>
          <select value={filialId} onChange={(e) => setFilialId(e.target.value ? Number(e.target.value) : '')} className={styles.selectDark}>
            <option value="">Selecione a filial</option>
            {filiaisSincronizadas.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>
        <div className={styles.fieldDark}>
          <label>LOTAÇÃO</label>
          <select value={lotacaoId} onChange={(e) => setLotacaoId(e.target.value ? Number(e.target.value) : '')} className={styles.selectDark}>
            <option value="">Todas as lotações</option>
            {lotacoes.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </div>
        <div className={styles.fieldDark}>
          <label>COLABORADOR</label>
          <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value ? Number(e.target.value) : '')} className={styles.selectDark} disabled={!filialId}>
            <option value="">Todos os colaboradores</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>
        <button type="button" className={styles.btnBuscar} onClick={() => void handleBuscar()} disabled={loading || !filialId}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {mensagem ? <p className={styles.resultMsg} role="status">{mensagem}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Período</th>
              <th>Turno</th>
              <th>Motivo</th>
              <th>Justificativa</th>
              <th>Anexo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pendentes.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyRow}>
                  {loading ? 'Buscando…' : 'Nenhuma ocorrência pendente encontrada para o filtro selecionado.'}
                </td>
              </tr>
            ) : (
              pendentes.map((item) => (
                <tr key={item.mobile_id}>
                  <td>{item.funcionario_nome}</td>
                  <td>{formatPeriodo(item.data_inicio, item.data_fim)}</td>
                  <td>{TURNO_LABELS[item.turno]}</td>
                  <td>{item.motivo_label ?? '—'}</td>
                  <td className={styles.justificativaCell}>{item.justificativa ?? '—'}</td>
                  <td>
                    {item.tem_anexo ? (
                      <button type="button" className={styles.anexoBtn} onClick={() => handleAbrirAnexo(item)}>
                        Ver anexo
                      </button>
                    ) : '—'}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btnRowAprovar}
                        onClick={() => setAprovando(item)}
                        disabled={rowLoadingId === item.mobile_id}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className={styles.btnRowNegar}
                        onClick={() => void handleNegar(item)}
                        disabled={rowLoadingId === item.mobile_id}
                      >
                        {rowLoadingId === item.mobile_id ? '…' : 'Negar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {aprovando && (
        <AprovarOcorrenciaModal
          item={aprovando}
          onClose={() => setAprovando(null)}
          onSuccess={handleAprovacaoConcluida}
        />
      )}
    </div>
  )
}
