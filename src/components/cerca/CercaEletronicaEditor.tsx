import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ApiError } from '../../lib/api'
import {
  fetchCerca,
  salvarCerca,
  type ConfiguracaoCerca,
  type EscopoCerca,
  type LocalCerca,
  type ValidaLocalizacao,
} from '../../services/cercasApi'
import styles from './CercaEletronicaEditor.module.css'

const RAIO_PADRAO = 100
// Sem nenhum local ainda: centro do Brasil.
const CENTRO_PADRAO: L.LatLngTuple = [-14.235, -51.925]

const COR_PROPRIO = '#14918b'
const COR_HERDADO = '#94a3b8'

const ORIGEM_LABEL: Record<EscopoCerca, string> = {
  filial: 'filial',
  lotacao: 'lotação',
  funcionario: 'funcionário',
}

const arred = (n: number) => Math.round(n * 1e7) / 1e7

/**
 * Editor da cerca eletrônica do Ponto Mobile para uma filial, lotação ou
 * funcionário: regra de validação + locais (lat/lng/raio) num mapa
 * OpenStreetMap. Salva por conta própria (independe do formulário em volta).
 */
export function CercaEletronicaEditor({ escopo, id }: { escopo: EscopoCerca; id: number }) {
  const [config, setConfig] = useState<ConfiguracaoCerca | null>(null)
  const [valida, setValida] = useState<ValidaLocalizacao>('nao')
  const [locais, setLocais] = useState<LocalCerca[]>([])
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const mapaDiv = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const camada = useRef<L.LayerGroup | null>(null)
  // Handler de clique do mapa lê o estado atual por ref (o mapa é criado uma vez).
  const cliqueRef = useRef<(lat: number, lng: number) => void>(() => {})

  const herdados: (LocalCerca & { origem: string })[] = [
    ...(config?.herdado?.filial?.locais ?? []).map((l) => ({ ...l, origem: `Filial ${config!.herdado!.filial!.nome}` })),
    ...(config?.herdado?.lotacao?.locais ?? []).map((l) => ({ ...l, origem: `Lotação ${config!.herdado!.lotacao!.nome}` })),
  ]

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const c = await fetchCerca(escopo, id)
      setConfig(c)
      setValida(c.valida_localizacao)
      setLocais(c.locais)
      setSelecionado(null)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível carregar a cerca eletrônica.')
    }
  }, [escopo, id])

  useEffect(() => { void carregar() }, [carregar])

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!mapaDiv.current || mapa.current) return
    const m = L.map(mapaDiv.current, { center: CENTRO_PADRAO, zoom: 4 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m)
    camada.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => cliqueRef.current(e.latlng.lat, e.latlng.lng))
    mapa.current = m
    return () => { m.remove(); mapa.current = null }
  }, [])

  // Clique no mapa: move o local selecionado ou cria um novo ali.
  cliqueRef.current = (lat, lng) => {
    if (selecionado !== null && locais[selecionado]) {
      setLocais((ls) => ls.map((l, i) => (i === selecionado ? { ...l, latitude: arred(lat), longitude: arred(lng) } : l)))
    } else {
      setLocais((ls) => [...ls, { descricao: `Local ${ls.length + 1}`, latitude: arred(lat), longitude: arred(lng), raio_metros: RAIO_PADRAO }])
      setSelecionado(locais.length)
    }
  }

  // Redesenha os círculos quando os locais mudam.
  useEffect(() => {
    const g = camada.current
    if (!g) return
    g.clearLayers()
    for (const h of herdados) {
      L.circle([h.latitude, h.longitude], { radius: h.raio_metros, color: COR_HERDADO, dashArray: '6 6', weight: 2, fillOpacity: 0.08 })
        .bindTooltip(`${h.descricao ?? 'Local'} — ${h.origem}`)
        .addTo(g)
    }
    locais.forEach((l, i) => {
      L.circle([l.latitude, l.longitude], {
        radius: l.raio_metros,
        color: COR_PROPRIO,
        weight: i === selecionado ? 4 : 2,
        fillOpacity: i === selecionado ? 0.25 : 0.12,
      })
        .bindTooltip(l.descricao ?? `Local ${i + 1}`)
        .on('click', (e) => { L.DomEvent.stopPropagation(e); setSelecionado(i) })
        .addTo(g)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locais, selecionado, config])

  // Enquadra todos os locais quando a configuração chega.
  useEffect(() => {
    const m = mapa.current
    if (!m || !config) return
    const pontos = [...config.locais, ...herdados].map((l) => L.latLng(l.latitude, l.longitude))
    if (pontos.length === 1) m.setView(pontos[0], 16)
    else if (pontos.length > 1) m.fitBounds(L.latLngBounds(pontos).pad(0.3))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  function alterar(i: number, campo: keyof LocalCerca, valor: string) {
    // Colar "lat, lng" (copiado do Google Maps) na latitude preenche os dois.
    if (campo === 'latitude' && valor.includes(',')) {
      const [lat, lng] = valor.split(',').map((v) => Number(v.trim()))
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setLocais((ls) => ls.map((l, k) => (k === i ? { ...l, latitude: arred(lat), longitude: arred(lng) } : l)))
        mapa.current?.setView([lat, lng], 16)
        return
      }
    }
    setLocais((ls) => ls.map((l, k) => {
      if (k !== i) return l
      if (campo === 'descricao') return { ...l, descricao: valor }
      const n = Number(valor.trim())
      if (valor.trim() === '' || !Number.isFinite(n)) return l
      return { ...l, [campo]: campo === 'raio_metros' ? Math.round(n) : arred(n) }
    }))
  }

  function adicionarNoCentro() {
    const c = mapa.current?.getCenter()
    const novo: LocalCerca = {
      descricao: `Local ${locais.length + 1}`,
      latitude: arred(c?.lat ?? CENTRO_PADRAO[0]),
      longitude: arred(c?.lng ?? CENTRO_PADRAO[1]),
      raio_metros: RAIO_PADRAO,
    }
    setLocais((ls) => [...ls, novo])
    setSelecionado(locais.length)
  }

  function minhaLocalizacao() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => mapa.current?.setView([p.coords.latitude, p.coords.longitude], 17),
      () => setErro('Não foi possível obter sua localização (permissão negada?).'),
    )
  }

  async function salvar() {
    setErro(null)
    setOk(null)
    if (locais.some((l) => l.raio_metros < 10)) { setErro('O raio mínimo é de 10 metros.'); return }
    setSalvando(true)
    try {
      setOk(await salvarCerca(escopo, id, { valida_localizacao: valida, locais }))
      await carregar()
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar a cerca eletrônica.')
    } finally {
      setSalvando(false)
    }
  }

  // Regra que vale de fato: a deste nível, ou a herdada.
  const efetiva = valida === 'herdar'
    ? (config?.herdado?.origem_validacao && config.herdado.origem_validacao !== 'funcionario'
      ? config.herdado.valida_localizacao_efetiva
      : null)
    : valida === 'sim'
  const totalLocais = locais.length + herdados.length

  return (
    <div className={styles.wrap}>
      <div className={styles.topo}>
        <label className={styles.campo}>
          <span>Validar localização no Ponto Mobile</span>
          <select value={valida} onChange={(e) => setValida(e.target.value as ValidaLocalizacao)}>
            {escopo !== 'filial' && <option value="herdar">Herdar ({escopo === 'funcionario' ? 'da lotação / filial' : 'da filial'})</option>}
            <option value="sim">Sim — só bate ponto dentro da cerca</option>
            <option value="nao">Não — bate ponto de qualquer lugar</option>
          </select>
        </label>
        {valida === 'herdar' && escopo === 'funcionario' && config?.herdado && (
          <p className={styles.hint}>
            Hoje: {config.herdado.valida_localizacao_efetiva ? 'valida' : 'não valida'} a localização
            {config.herdado.origem_validacao && config.herdado.origem_validacao !== 'funcionario'
              ? ` (definido na ${ORIGEM_LABEL[config.herdado.origem_validacao]})` : ''}.
          </p>
        )}
        {efetiva === true && totalLocais === 0 && (
          <p className={styles.aviso}>
            Sem nenhum local cadastrado, o app exige o GPS ligado mas aceita a batida de qualquer lugar.
          </p>
        )}
      </div>

      <div className={styles.mapaBarra}>
        <span className={styles.hint}>
          Clique no mapa para {selecionado !== null ? 'mover o local selecionado' : 'adicionar um local'}.
          {herdados.length > 0 && ' Círculos tracejados vêm da filial/lotação.'}
        </span>
        <span className={styles.acoes}>
          <button type="button" className={styles.btn} onClick={minhaLocalizacao}>Minha localização</button>
          <button type="button" className={styles.btn} onClick={adicionarNoCentro}>+ Local no centro do mapa</button>
        </span>
      </div>
      <div ref={mapaDiv} className={styles.mapa} />

      {locais.length > 0 && (
        <table className={styles.tabela}>
          <thead>
            <tr><th>Descrição</th><th>Latitude</th><th>Longitude</th><th>Raio (m)</th><th /></tr>
          </thead>
          <tbody>
            {locais.map((l, i) => (
              <tr key={i} className={i === selecionado ? styles.linhaSel : undefined} onClick={() => setSelecionado(i)}>
                <td><input value={l.descricao ?? ''} maxLength={120} onChange={(e) => alterar(i, 'descricao', e.target.value)} /></td>
                {/* Números editados como texto e aplicados ao sair do campo — controlado
                    por número, digitar "-" ou "-10." era desfeito a cada tecla. A key
                    remonta o campo quando o valor muda pelo mapa. */}
                <td>
                  <input
                    key={`lat-${i}-${l.latitude}`}
                    defaultValue={l.latitude}
                    inputMode="decimal"
                    title='Cole "lat, lng" do Google Maps aqui'
                    onChange={(e) => { if (e.target.value.includes(',')) alterar(i, 'latitude', e.target.value) }}
                    onBlur={(e) => alterar(i, 'latitude', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    key={`lng-${i}-${l.longitude}`}
                    defaultValue={l.longitude}
                    inputMode="decimal"
                    onBlur={(e) => alterar(i, 'longitude', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    key={`raio-${i}-${l.raio_metros}`}
                    defaultValue={l.raio_metros}
                    inputMode="numeric"
                    onBlur={(e) => alterar(i, 'raio_metros', e.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.remover}
                    title="Remover local"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLocais((ls) => ls.filter((_, k) => k !== i))
                      setSelecionado(null)
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {herdados.length > 0 && (
        <p className={styles.hint}>
          Também vale: {herdados.map((h) => `${h.descricao ?? 'Local'} (${h.origem}, ${h.raio_metros} m)`).join(' · ')}
        </p>
      )}

      {erro && <p className={styles.erro}>{erro}</p>}
      {ok && <p className={styles.ok}>{ok}</p>}

      <div className={styles.rodape}>
        <button type="button" className={styles.btnSalvar} disabled={salvando || !config} onClick={() => void salvar()}>
          {salvando ? 'Salvando…' : 'Salvar cerca eletrônica'}
        </button>
      </div>
    </div>
  )
}
