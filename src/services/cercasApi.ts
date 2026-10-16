import { apiRequest } from '../lib/api'

/**
 * Cerca eletrônica do Ponto Mobile por filial, lotação ou funcionário.
 * No app, cada funcionário pode bater ponto em qualquer local da filial, da
 * lotação ou dele próprio (soma); "validar localização" vem do nível mais
 * específico definido (funcionário → lotação → filial).
 */
export type EscopoCerca = 'filial' | 'lotacao' | 'funcionario'
export type ValidaLocalizacao = 'herdar' | 'sim' | 'nao'

export type LocalCerca = {
  id?: number
  descricao: string | null
  latitude: number
  longitude: number
  raio_metros: number
}

export type ConfiguracaoCerca = {
  valida_localizacao: ValidaLocalizacao
  locais: LocalCerca[]
  /** Só para funcionário: o que vem da filial e da lotação. */
  herdado: {
    filial: { nome: string; locais: LocalCerca[] } | null
    lotacao: { nome: string; locais: LocalCerca[] } | null
    valida_localizacao_efetiva: boolean
    origem_validacao: EscopoCerca | null
  } | null
}

export async function fetchCerca(escopo: EscopoCerca, id: number): Promise<ConfiguracaoCerca> {
  const r = await apiRequest<{ data: ConfiguracaoCerca }>(`/api/cercas/${escopo}/${id}`)
  return r.data
}

export async function salvarCerca(
  escopo: EscopoCerca,
  id: number,
  payload: { valida_localizacao: ValidaLocalizacao; locais: LocalCerca[] },
): Promise<string> {
  const r = await apiRequest<{ message?: string }>(`/api/cercas/${escopo}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      valida_localizacao: payload.valida_localizacao,
      locais: payload.locais.map(({ descricao, latitude, longitude, raio_metros }) => ({
        descricao: descricao?.trim() || null,
        latitude,
        longitude,
        raio_metros,
      })),
    }),
  })
  return r.message ?? 'Cerca salva.'
}
