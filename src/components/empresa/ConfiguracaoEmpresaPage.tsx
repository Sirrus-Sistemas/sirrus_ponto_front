import { useEffect, useState } from 'react'
import { fetchEmpresa, updateEmpresaMunicipio, type EmpresaInfo } from '../../services/empresaApi'
import { fetchMunicipios, type Municipio } from '../../services/municipiosApi'
import styles from './ConfiguracaoEmpresaPage.module.css'

export function ConfiguracaoEmpresaPage() {
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)

  // Município selecionado
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [municipioQuery, setMunicipioQuery] = useState('')
  const [municipioResults, setMunicipioResults] = useState<Municipio[]>([])
  const [municipioOpen, setMunicipioOpen] = useState(false)
  const [municipioFuso, setMunicipioFuso] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchEmpresa()
      .then((emp) => {
        if (cancelled) return
        setEmpresa(emp)
        setMunicipioId(emp.municipio_id)
        setMunicipioFuso(emp.municipio_fuso_horario)
        if (emp.municipio_nome) {
          setMunicipioQuery(`${emp.municipio_nome} — ${emp.municipio_estado ?? ''}`)
        }
      })
      .catch(() => { if (!cancelled) setFeedback({ type: 'error', msg: 'Erro ao carregar dados da empresa.' }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Busca debounced de municípios
  useEffect(() => {
    if (!municipioQuery.trim() || municipioQuery.includes('—')) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetchMunicipios({ search: municipioQuery.trim(), limit: 10 })
        if (!cancelled) setMunicipioResults(res.rows)
      } catch { if (!cancelled) setMunicipioResults([]) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [municipioQuery])

  function selectMunicipio(m: Municipio) {
    setMunicipioId(m.CODMUNICIPIO)
    setMunicipioFuso(m.fuso_horario)
    setMunicipioQuery(`${m.NOMEMUNICIPIO} — ${m.ESTADO}`)
    setMunicipioResults([])
    setMunicipioOpen(false)
  }

  function clearMunicipio() {
    setMunicipioId(null)
    setMunicipioFuso(null)
    setMunicipioQuery('')
    setMunicipioResults([])
  }

  async function handleSave() {
    setFeedback(null)
    setSaving(true)
    try {
      await updateEmpresaMunicipio(municipioId)
      setFeedback({ type: 'ok', msg: 'Configuração salva com sucesso.' })
    } catch {
      setFeedback({ type: 'error', msg: 'Erro ao salvar. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={styles.loading}>Carregando…</div>

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Configuração da Empresa</h1>
      <p className={styles.subtitle}>
        Vincule um município à empresa para definir o fuso horário padrão dos colaboradores
        que não possuem cidade cadastrada.
      </p>

      {/* Informações da empresa */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Dados da empresa</p>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Razão Social</span>
            <span className={styles.infoValue}>{empresa?.razao_social ?? '—'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>CNPJ</span>
            <span className={styles.infoValue}>{empresa?.cnpj ?? '—'}</span>
          </div>
          {empresa?.cidade ? (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Cidade (cadastro)</span>
              <span className={styles.infoValue}>{empresa.cidade}{empresa.uf ? ` — ${empresa.uf}` : ''}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Seletor de município */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Município para fuso horário</p>

        {feedback ? (
          <p className={`${styles.feedback} ${feedback.type === 'ok' ? styles.feedbackOk : styles.feedbackError}`}>
            {feedback.msg}
          </p>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="emp-municipio">Cidade / Município</label>
          <div className={styles.comboWrap}>
            <span className={styles.comboSearchIcon}>🔍</span>
            <input
              id="emp-municipio"
              autoComplete="off"
              placeholder="Digite para buscar…"
              value={municipioQuery}
              onChange={(e) => {
                setMunicipioQuery(e.target.value)
                setMunicipioOpen(true)
                if (!e.target.value.trim()) clearMunicipio()
              }}
              onFocus={() => setMunicipioOpen(true)}
              onBlur={() => setTimeout(() => setMunicipioOpen(false), 150)}
            />
            {municipioId != null && (
              <button type="button" className={styles.comboClear} onClick={clearMunicipio} aria-label="Limpar município">
                ✕
              </button>
            )}
            {municipioOpen && municipioResults.length > 0 && (
              <ul className={styles.comboList}>
                {municipioResults.map((m) => (
                  <li key={m.CODMUNICIPIO} className={styles.comboItem} onMouseDown={() => selectMunicipio(m)}>
                    <span className={styles.comboNome}>{m.NOMEMUNICIPIO}</span>
                    <span className={styles.comboUf}>{m.ESTADO}</span>
                    <span className={styles.comboFuso}>{m.fuso_horario}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {municipioFuso ? (
            <span className={styles.fusoTag}>🕐 {municipioFuso}</span>
          ) : (
            <p className={styles.hint}>define o fuso horário padrão da empresa</p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
