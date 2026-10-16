import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { fetchFiliais, type Filial } from '../../services/filiaisApi'
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi'
import { baixarArquivoMte, type ArquivoMte } from '../../services/mteApi'
import { DatePicker } from '../ui/DatePicker'
import styles from './ArquivosMtePage.module.css'

const ARQUIVOS: { id: ArquivoMte; nome: string; portaria: string; desc: string; porLotacao: boolean }[] = [
  {
    id: 'aej',
    nome: 'AEJ',
    portaria: 'Portaria 671',
    desc: 'Arquivo Eletrônico de Jornada: vínculos, horários contratuais, marcações tratadas e ausências. É o arquivo exigido hoje do programa de tratamento.',
    porLotacao: true,
  },
  {
    id: 'afd',
    nome: 'AFD — REP-P',
    portaria: 'Portaria 671',
    desc: 'Batidas feitas pelo aplicativo Ponto Mobile e pela web (REP-P), com hash encadeado. O AFD dos relógios é o do próprio equipamento.',
    porLotacao: false,
  },
  {
    id: 'afdt',
    nome: 'AFDT',
    portaria: 'Portaria 1510',
    desc: 'Arquivo Fonte de Dados Tratados: cada batida com a origem (O = original, I = incluída) e o motivo.',
    porLotacao: true,
  },
  {
    id: 'acjef',
    nome: 'ACJEF',
    portaria: 'Portaria 1510',
    desc: 'Controle de Jornada para Efeitos Fiscais: por dia, horas normais, noturnas, extras, faltas e saldo de compensação.',
    porLotacao: true,
  },
]

function inicioDoMesPassado() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10)
}
function fimDoMesPassado() {
  const d = new Date()
  const f = new Date(d.getFullYear(), d.getMonth(), 0)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

/** Exportação dos arquivos do Ministério do Trabalho (AEJ, AFD, AFDT, ACJEF). */
export function ArquivosMtePage() {
  const { me, meReady } = useOutletContext<AppShellOutletContext>()
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([])
  const [arquivo, setArquivo] = useState<ArquivoMte>('aej')
  const [filialId, setFilialId] = useState('')
  const [lotacaoId, setLotacaoId] = useState('')
  const [inicio, setInicio] = useState(inicioDoMesPassado)
  const [fim, setFim] = useState(fimDoMesPassado)
  const [gerando, setGerando] = useState<'txt' | 'p7s' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    fetchFiliais().then((l) => {
      setFiliais(l)
      if (l.length === 1) setFilialId(String(l[0].id))
    }).catch(() => setFiliais([]))
    fetchLotacoes().then(setLotacoes).catch(() => setLotacoes([]))
  }, [])

  const escolhido = ARQUIVOS.find((a) => a.id === arquivo)!

  async function gerar(assinar: boolean) {
    setErro(null)
    setOk(null)
    if (!filialId) { setErro('Selecione a filial.'); return }
    if (!inicio || !fim || inicio > fim) { setErro('Informe um período válido.'); return }
    setGerando(assinar ? 'p7s' : 'txt')
    try {
      const avisos = await baixarArquivoMte(arquivo, {
        filialId: Number(filialId),
        lotacaoId: escolhido.porLotacao && lotacaoId ? Number(lotacaoId) : undefined,
        inicio,
        fim,
        assinar,
      })
      setOk(`${escolhido.nome} gerado.${avisos.length ? ` Atenção: ${avisos.join(' ')}` : ''}`)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível gerar o arquivo.')
    } finally {
      setGerando(null)
    }
  }

  if (!meReady) return <p className={styles.loading}>Carregando…</p>
  if (!me || (me.role !== 'admin' && me.role !== 'gestor')) {
    return (
      <div className={styles.wrap}>
        <h2>Acesso restrito</h2>
        <p><Link to="/dashboard">Voltar ao dashboard</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Arquivos do Ministério do Trabalho</h1>
      <p className={styles.subtitle}>
        Geração dos arquivos para fiscalização. Os cálculos são os mesmos da Ficha e do Espelho de Ponto.
      </p>

      <div className={styles.cards} role="radiogroup" aria-label="Arquivo">
        {ARQUIVOS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={arquivo === a.id}
            className={`${styles.card} ${arquivo === a.id ? styles.cardAtivo : ''}`}
            onClick={() => setArquivo(a.id)}
          >
            <span className={styles.cardTopo}>
              <strong>{a.nome}</strong>
              <span className={styles.portaria}>{a.portaria}</span>
            </span>
            <span className={styles.cardDesc}>{a.desc}</span>
          </button>
        ))}
      </div>

      <div className={styles.filtros}>
        <label className={styles.campo}>
          <span>Filial</span>
          <select value={filialId} onChange={(e) => setFilialId(e.target.value)}>
            <option value="">Selecione…</option>
            {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span>Lotação</span>
          <select
            value={escolhido.porLotacao ? lotacaoId : ''}
            onChange={(e) => setLotacaoId(e.target.value)}
            disabled={!escolhido.porLotacao}
            title={escolhido.porLotacao ? undefined : 'O AFD é do REP (por filial), sem filtro de lotação.'}
          >
            <option value="">Todas</option>
            {lotacoes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <div className={styles.campo}>
          <span>De</span>
          <DatePicker id="mte-inicio" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className={styles.campo}>
          <span>Até</span>
          <DatePicker id="mte-fim" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>

      {erro && <p className={styles.erro} role="alert">{erro}</p>}
      {ok && <p className={styles.ok} role="status">{ok}</p>}

      <div className={styles.acoes}>
        <button type="button" className={styles.btnSecundario} disabled={gerando !== null} onClick={() => void gerar(false)}>
          {gerando === 'txt' ? 'Gerando…' : 'Baixar .txt'}
        </button>
        <button type="button" className={styles.btnPrimario} disabled={gerando !== null} onClick={() => void gerar(true)}>
          {gerando === 'p7s' ? 'Gerando…' : 'Baixar assinado (.p7s)'}
        </button>
      </div>
      <p className={styles.hint}>
        O arquivo assinado (PKCS#7, certificado da Sirrus) é o que se entrega na fiscalização pela Portaria 671 — o .txt serve para conferência.
      </p>
    </div>
  )
}
