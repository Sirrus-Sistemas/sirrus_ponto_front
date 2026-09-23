import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi'
import {
  fetchBancoHoras,
  lancarBancoHoras,
  excluirBancoHoras,
  fecharMesBancoHoras,
  type SaldoBancoHoras,
  type TipoHora,
  type TipoLancamento,
} from '../../services/bancoHorasApi'
import styles from './BancoHorasPage.module.css'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

function minToHHMM(min: number): string {
  const sinal = min < 0 ? '-' : ''
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" ou "H:MM" → minutos. null se inválido. */
function hhmmToMin(v: string): number | null {
  const m = v.trim().match(/^(\d{1,3}):([0-5]\d)$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

const TIPO_HORA_LABEL: Record<TipoHora, string> = { '50pct': '50%', '100pct': '100%' }

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function mesAnoAtual(): string {
  return new Date().toISOString().slice(0, 7)
}

export function BancoHorasPage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()

  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([])
  const [funcionarioId, setFuncionarioId] = useState<number | ''>('')
  const [busca, setBusca] = useState('')

  const [saldo, setSaldo] = useState<SaldoBancoHoras | null>(null)
  const [loadingSaldo, setLoadingSaldo] = useState(false)
  const [saldoError, setSaldoError] = useState<string | null>(null)

  // Form de lançamento manual
  const [data, setData] = useState(hojeIso())
  const [mesReferencia, setMesReferencia] = useState(mesAnoAtual())
  const [tipoHora, setTipoHora] = useState<TipoHora>('50pct')
  const [tipo, setTipo] = useState<TipoLancamento>('credito')
  const [horas, setHoras] = useState('')
  const [motivo, setMotivo] = useState('')
  const [lancando, setLancando] = useState(false)
  const [lancarError, setLancarError] = useState<string | null>(null)
  const [lancarOk, setLancarOk] = useState<string | null>(null)

  // Fechamento mensal
  const [fecharMesAno, setFecharMesAno] = useState(mesAnoAtual())
  const [fechando, setFechando] = useState(false)
  const [fecharError, setFecharError] = useState<string | null>(null)
  const [fecharOk, setFecharOk] = useState<string | null>(null)

  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [excluirErro, setExcluirErro] = useState<string | null>(null)

  useEffect(() => {
    fetchFuncionarios({ limit: 1000, ativo: 1 })
      .then((r) => setFuncionarios(r.data))
      .catch(() => {})
  }, [])

  const carregarSaldo = useCallback((id: number) => {
    setLoadingSaldo(true)
    setSaldoError(null)
    fetchBancoHoras(id)
      .then((r) => setSaldo(r))
      .catch((e) => { setSaldo(null); setSaldoError(errMsg(e, 'Erro ao carregar banco de horas.')) })
      .finally(() => setLoadingSaldo(false))
  }, [])

  useEffect(() => {
    if (funcionarioId) carregarSaldo(funcionarioId)
    else setSaldo(null)
  }, [funcionarioId, carregarSaldo])

  const funcionariosFiltrados = busca.trim()
    ? funcionarios.filter((f) => f.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : funcionarios

  async function handleLancar() {
    setLancarError(null)
    setLancarOk(null)
    if (!funcionarioId) { setLancarError('Selecione um funcionário.'); return }
    const minutos = hhmmToMin(horas)
    if (minutos == null || minutos <= 0) { setLancarError('Informe a quantidade de horas no formato HH:MM (ex.: 03:00).'); return }
    if (!/^\d{4}-\d{2}$/.test(mesReferencia)) { setLancarError('Selecione o mês/ano do lançamento.'); return }

    setLancando(true)
    try {
      await lancarBancoHoras({
        funcionario_id: funcionarioId,
        data,
        mes_referencia: mesReferencia,
        tipo,
        tipo_hora: tipoHora,
        minutos,
        descricao: motivo.trim() || null,
      })
      setLancarOk('Lançamento gravado com sucesso.')
      setHoras('')
      setMotivo('')
      carregarSaldo(funcionarioId)
    } catch (e) {
      setLancarError(errMsg(e, 'Não foi possível gravar o lançamento.'))
    } finally {
      setLancando(false)
    }
  }

  async function handleFecharMes() {
    setFecharError(null)
    setFecharOk(null)
    if (!funcionarioId) { setFecharError('Selecione um funcionário.'); return }
    if (!/^\d{4}-\d{2}$/.test(fecharMesAno)) { setFecharError('Selecione o mês/ano a fechar.'); return }
    const [anoStr, mesStr] = fecharMesAno.split('-')

    setFechando(true)
    try {
      const r = await fecharMesBancoHoras(funcionarioId, Number(anoStr), Number(mesStr))
      setFecharOk(
        r.lancamentos.length > 0
          ? `Mês ${r.mes_referencia} fechado: ${r.lancamentos.map((l) => `${TIPO_HORA_LABEL[l.tipo_hora]} ${l.tipo === 'credito' ? '+' : '-'}${minToHHMM(l.minutos)}`).join(', ')}.`
          : `Mês ${r.mes_referencia} fechado sem saldo a lançar.`,
      )
      carregarSaldo(funcionarioId)
    } catch (e) {
      setFecharError(errMsg(e, 'Não foi possível fechar o mês.'))
    } finally {
      setFechando(false)
    }
  }

  async function handleExcluir(id: number, descricao: string | null) {
    if (!funcionarioId) return
    const confirmar = window.confirm(
      `Excluir este lançamento${descricao ? ` ("${descricao}")` : ''}? Essa ação fica registrada na auditoria e não pode ser desfeita.`,
    )
    if (!confirmar) return

    setExcluindoId(id)
    setExcluirErro(null)
    try {
      await excluirBancoHoras(id)
      carregarSaldo(funcionarioId)
    } catch (e) {
      setExcluirErro(errMsg(e, 'Não foi possível excluir o lançamento.'))
    } finally {
      setExcluindoId(null)
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>

  if (!me || (me.role !== 'admin' && me.role !== 'gestor')) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Acesso restrito</h2>
        <p><Link to="/dashboard">Voltar</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Banco de Horas</h1>
      <p className={styles.subtitle}>
        Saldo acumulado de horas extras (50% e 100%) por funcionário — lance ajustes manuais ou feche
        o saldo líquido da ficha de ponto do mês.
      </p>

      <div className={styles.card}>
        <div className={styles.field}>
          <label htmlFor="bh-busca">Funcionário</label>
          <input
            id="bh-busca"
            type="search"
            placeholder="Digite o nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <select
            value={funcionarioId}
            onChange={(e) => setFuncionarioId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Selecione…</option>
            {funcionariosFiltrados.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingSaldo && <p className={styles.loading}>Carregando saldo…</p>}
      {saldoError && <p className={styles.error} role="alert">{saldoError}</p>}

      {saldo && (
        <>
          <div className={styles.saldoRow}>
            <div className={styles.saldoCard}>
              <span className={styles.saldoLabel}>Saldo 50%</span>
              <span className={`${styles.saldoValor} ${saldo.saldo_50pct_minutos < 0 ? styles.saldoNegativo : ''}`}>
                {minToHHMM(saldo.saldo_50pct_minutos)}
              </span>
            </div>
            <div className={styles.saldoCard}>
              <span className={styles.saldoLabel}>Saldo 100%</span>
              <span className={`${styles.saldoValor} ${saldo.saldo_100pct_minutos < 0 ? styles.saldoNegativo : ''}`}>
                {minToHHMM(saldo.saldo_100pct_minutos)}
              </span>
            </div>
          </div>

          <div className={styles.twoCol}>
            {/* Lançamento manual */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Lançamento manual</p>

              {lancarError && <p className={styles.error} role="alert">{lancarError}</p>}
              {lancarOk && <p className={styles.ok}>{lancarOk}</p>}

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="bh-data">Data</label>
                  <input id="bh-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="bh-mesano">Mês/Ano</label>
                  <input id="bh-mesano" type="month" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="bh-horas">Qtde. Horas (HH:MM)</label>
                  <input id="bh-horas" placeholder="03:00" value={horas} onChange={(e) => setHoras(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="bh-tipohora">Tipo de Hora</label>
                  <select id="bh-tipohora" value={tipoHora} onChange={(e) => setTipoHora(e.target.value as TipoHora)}>
                    <option value="50pct">50%</option>
                    <option value="100pct">100%</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="bh-tipo">Tipo</label>
                  <select id="bh-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamento)}>
                    <option value="credito">Crédito</option>
                    <option value="debito">Débito</option>
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="bh-motivo">Motivo</label>
                <input id="bh-motivo" placeholder="Ex.: Saldo inicial, acordo de compensação…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleLancar()} disabled={lancando}>
                  {lancando ? 'Lançando…' : 'Lançar'}
                </button>
              </div>
            </div>

            {/* Fechamento mensal */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Fechar mês da ficha de ponto</p>
              <p className={styles.hint}>
                Soma o saldo líquido de extras 50%/100% e débito da ficha do mês escolhido e grava no
                banco de horas. Um mês só pode ser fechado uma vez por tipo de hora.
              </p>

              {fecharError && <p className={styles.error} role="alert">{fecharError}</p>}
              {fecharOk && <p className={styles.ok}>{fecharOk}</p>}

              <div className={styles.field}>
                <label htmlFor="bh-fechar-mesano">Mês/Ano a fechar</label>
                <input id="bh-fechar-mesano" type="month" value={fecharMesAno} onChange={(e) => setFecharMesAno(e.target.value)} />
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleFecharMes()} disabled={fechando}>
                  {fechando ? 'Fechando…' : 'Fechar mês'}
                </button>
              </div>
            </div>
          </div>

          {/* Extrato */}
          <div className={styles.card}>
            <p className={styles.cardTitle}>Extrato</p>
            {excluirErro && <p className={styles.error} role="alert">{excluirErro}</p>}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Mês/Ano</th>
                    <th>Tipo Horas</th>
                    <th>Crédito</th>
                    <th>Débito</th>
                    <th>Saldo Após</th>
                    <th>Origem</th>
                    <th>Motivo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {saldo.data.length === 0 ? (
                    <tr><td colSpan={9} className={styles.emptyRow}>Nenhum lançamento ainda.</td></tr>
                  ) : (
                    saldo.data.map((l) => (
                      <tr key={l.id}>
                        <td>{l.data.slice(8, 10)}/{l.data.slice(5, 7)}/{l.data.slice(0, 4)}</td>
                        <td>{l.mes_referencia}</td>
                        <td>{TIPO_HORA_LABEL[l.tipo_hora]}</td>
                        <td className={styles.tdCredito}>{l.tipo === 'credito' ? minToHHMM(l.minutos) : ''}</td>
                        <td className={styles.tdDebito}>{l.tipo === 'debito' ? minToHHMM(l.minutos) : ''}</td>
                        <td>{minToHHMM(l.saldo_posterior)}</td>
                        <td>{l.origem === 'manual' ? 'Manual' : 'Fechamento mensal'}</td>
                        <td>{l.descricao ?? '—'}</td>
                        <td>
                          {l.origem === 'manual' ? (
                            <button
                              type="button"
                              className={styles.btnExcluir}
                              onClick={() => void handleExcluir(l.id, l.descricao)}
                              disabled={excluindoId === l.id}
                            >
                              {excluindoId === l.id ? '…' : 'Excluir'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
