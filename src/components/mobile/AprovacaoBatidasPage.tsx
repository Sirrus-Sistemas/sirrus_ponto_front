import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import 'dayjs/locale/pt-br'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchMobileFiliais, type FilialMobileItem } from '../../services/mobileApi'
import { fetchEmpresa } from '../../services/empresaApi'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import {
  fetchPendentesAprovacao,
  decidirMarcacoesMobile,
  type MarcacaoPendente,
  type DecidirResult,
} from '../../services/aprovacaoMobileApi'
import styles from './AprovacaoBatidasPage.module.css'

dayjs.locale('pt-br')

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

function formatDataHora(utcStr: string): string {
  // "2026-07-05 00:00:20" (UTC, sem fuso) — exibe em UTC mesmo (aproximação simples;
  // suficiente para o operador reconhecer o dia/horário da batida ao revisar).
  const d = new Date(utcStr.replace(' ', 'T') + 'Z')
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function AprovacaoBatidasPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [filiais, setFiliais] = useState<FilialMobileItem[]>([])
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])

  const [filialId, setFilialId] = useState<number | ''>('')
  const [lotacaoId, setLotacaoId] = useState<number | ''>('')
  const [funcionarioId, setFuncionarioId] = useState<number | ''>('')
  const [dataInicio, setDataInicio] = useState<Dayjs | null>(() => dayjs().subtract(7, 'day'))
  const [dataFim, setDataFim] = useState<Dayjs | null>(() => dayjs())

  const [pendentes, setPendentes] = useState<MarcacaoPendente[]>([])
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [decidindo, setDecidindo] = useState(false)
  const [resultado, setResultado] = useState<DecidirResult | null>(null)
  const [rowLoadingId, setRowLoadingId] = useState<number | null>(null)

  const [aprovacaoAtiva, setAprovacaoAtiva] = useState<boolean | null>(null)

  useEffect(() => {
    fetchEmpresa()
      .then((emp) => setAprovacaoAtiva(Number(emp.aprovacao_mobile_ativa) === 1))
      .catch(() => setAprovacaoAtiva(false))
  }, [])

  useEffect(() => {
    fetchMobileFiliais().then(setFiliais).catch(() => {})
    fetchLotacoes().then(setLotacoes).catch(() => {})
  }, [])

  useEffect(() => {
    setFuncionarioId('')
    if (!filialId) { setFuncionarios([]); return }
    fetchFuncionarios({ limit: 1000, ativo: 1, filial_id: filialId, lotacao_id: lotacaoId || undefined })
      .then((r) => setFuncionarios(r.data))
      .catch(() => {})
  }, [filialId, lotacaoId])

  async function handleBuscar() {
    if (!filialId) return
    setLoading(true)
    setError(null)
    setResultado(null)
    try {
      const r = await fetchPendentesAprovacao({
        filialId,
        dataInicio: dataInicio?.format('YYYY-MM-DD') ?? '',
        dataFim: dataFim?.format('YYYY-MM-DD') ?? '',
        lotacaoId: lotacaoId || undefined,
        funcionarioId: funcionarioId || undefined,
      })
      setPendentes(r)
      setSelecionados(new Set(r.map((i) => i.mobile_id))) // tudo selecionado por padrão
    } catch (e) {
      setError(errMsg(e, 'Erro ao buscar batidas pendentes.'))
      setPendentes([])
    } finally {
      setLoading(false)
    }
  }

  function toggleSelecionado(mobileId: number) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(mobileId)) next.delete(mobileId); else next.add(mobileId)
      return next
    })
  }

  function toggleSelecionarTodos() {
    setSelecionados((prev) => (prev.size === pendentes.length ? new Set() : new Set(pendentes.map((i) => i.mobile_id))))
  }

  async function handleDecidir(itens: MarcacaoPendente[], status: 'C' | 'N') {
    if (itens.length === 0) return
    setDecidindo(true)
    setError(null)
    try {
      const r = await decidirMarcacoesMobile(itens, status)
      setResultado(r)
      const processadosIds = new Set(itens.map((i) => i.mobile_id))
      setPendentes((prev) => prev.filter((p) => !processadosIds.has(p.mobile_id)))
      setSelecionados((prev) => {
        const next = new Set(prev)
        processadosIds.forEach((id) => next.delete(id))
        return next
      })
    } catch (e) {
      setError(errMsg(e, 'Erro ao processar a decisão.'))
    } finally {
      setDecidindo(false)
      setRowLoadingId(null)
    }
  }

  async function handleDecidirLinha(item: MarcacaoPendente, status: 'C' | 'N') {
    setRowLoadingId(item.mobile_id)
    await handleDecidir([item], status)
  }

  if (!meReady || aprovacaoAtiva === null) return <p className={styles.loading}>Carregando…</p>
  if (me?.role !== 'admin') {
    return <p className={styles.denied}>Acesso restrito a administradores.</p>
  }
  if (!aprovacaoAtiva) {
    return (
      <p className={styles.denied}>
        A aprovação de batidas do app mobile não está habilitada para esta empresa. Ative o
        parâmetro em Configuração da Empresa para usar esta tela.
      </p>
    )
  }

  const filiaisSincronizadas = filiais.filter((f) => f.pontomobile_id)
  const selecionadosItens = pendentes.filter((p) => selecionados.has(p.mobile_id))

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Aprovação de Batidas</h1>
          <p className={styles.subtitle}>
            Revise as batidas do app mobile aguardando aprovação — confira foto e localização antes
            de aprovar ou negar.
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
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
          <div className={styles.fieldDark}>
            <label>DATA INICIAL</label>
            <div className={styles.datepickerWrap}>
              <MuiDatePicker value={dataInicio} onChange={setDataInicio} format="DD/MM/YYYY" slotProps={{ textField: { size: 'small' } }} />
            </div>
          </div>
          <div className={styles.fieldDark}>
            <label>DATA FINAL</label>
            <div className={styles.datepickerWrap}>
              <MuiDatePicker value={dataFim} onChange={setDataFim} format="DD/MM/YYYY" slotProps={{ textField: { size: 'small' } }} />
            </div>
          </div>
        </LocalizationProvider>
        <button type="button" className={styles.btnBuscar} onClick={() => void handleBuscar()} disabled={loading || !filialId}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {resultado ? (
        <div className={styles.resultPills}>
          <span className={styles.pillOk}>✓ {resultado.processados} processada(s)</span>
          {resultado.erros.length > 0 && <span className={styles.pillErr}>{resultado.erros.length} erro(s)</span>}
        </div>
      ) : null}

      {pendentes.length > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selecionados.size} de {pendentes.length} selecionada(s)</span>
          <button type="button" className={styles.btnAprovar} onClick={() => void handleDecidir(selecionadosItens, 'C')} disabled={decidindo || selecionadosItens.length === 0}>
            Aprovar selecionados
          </button>
          <button type="button" className={styles.btnNegar} onClick={() => void handleDecidir(selecionadosItens, 'N')} disabled={decidindo || selecionadosItens.length === 0}>
            Negar selecionados
          </button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><input type="checkbox" checked={pendentes.length > 0 && selecionados.size === pendentes.length} onChange={toggleSelecionarTodos} /></th>
              <th>Funcionário</th>
              <th>Data / Hora</th>
              <th>Turno</th>
              <th>Tipo</th>
              <th>Observação</th>
              <th>Foto</th>
              <th>Localização</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pendentes.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.emptyRow}>
                  {loading ? 'Buscando…' : 'Nenhuma batida pendente encontrada para o filtro selecionado.'}
                </td>
              </tr>
            ) : (
              pendentes.map((item) => (
                <tr key={item.mobile_id}>
                  <td><input type="checkbox" checked={selecionados.has(item.mobile_id)} onChange={() => toggleSelecionado(item.mobile_id)} /></td>
                  <td>{item.funcionario_nome}</td>
                  <td>{formatDataHora(item.data_hora_utc)}</td>
                  <td>{item.turno ?? '—'}</td>
                  <td>
                    <span className={`${styles.tipoBadge} ${item.tipo === 'E' ? styles.tipoEntrada : styles.tipoSaida}`}>
                      {item.tipo === 'E' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td>{item.observacao ?? '—'}</td>
                  <td>
                    {item.foto_url ? (
                      <a href={item.foto_url} target="_blank" rel="noreferrer">
                        <img src={item.foto_url} alt="Foto da batida" className={styles.thumb} />
                      </a>
                    ) : '—'}
                  </td>
                  <td>
                    {item.latitude != null && item.longitude != null ? (
                      <a
                        className={styles.mapLink}
                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver no mapa
                      </a>
                    ) : '—'}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btnRowAprovar}
                        onClick={() => void handleDecidirLinha(item, 'C')}
                        disabled={decidindo && rowLoadingId === item.mobile_id}
                      >
                        {decidindo && rowLoadingId === item.mobile_id ? '…' : 'Aprovar'}
                      </button>
                      <button
                        type="button"
                        className={styles.btnRowNegar}
                        onClick={() => void handleDecidirLinha(item, 'N')}
                        disabled={decidindo && rowLoadingId === item.mobile_id}
                      >
                        {decidindo && rowLoadingId === item.mobile_id ? '…' : 'Negar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
