import { apiRequest } from '../lib/api'

export type TipoFeriado = 'nacional' | 'estadual' | 'municipal' | 'empresa'

export interface Feriado {
  id: number
  nome: string
  data: string          // formato YYYY-MM-DD ou MM-DD quando recorrente
  tipo: TipoFeriado
  recorrente: boolean   // se true, repete todo ano
  uf?: string | null
  municipio_ibge?: string | null
  municipio_nome?: string | null
  observacao?: string | null
  criado_em?: string
}

export interface FeriadoPayload {
  nome: string
  data: string
  tipo: TipoFeriado
  recorrente: boolean
  uf?: string | null
  municipio_ibge?: string | null
  observacao?: string | null
}

interface ListResponse {
  rows: Feriado[]
  total: number
}

interface ListParams {
  search?: string
  tipo?: string
  ano?: number | string
  page?: number
  limit?: number
}

type Wrapped<T> = { success: boolean; message: string; data: T }

export async function fetchFeriados(params: ListParams = {}): Promise<ListResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.tipo)   qs.set('tipo', params.tipo)
  if (params.ano)    qs.set('ano', String(params.ano))
  if (params.page)   qs.set('page', String(params.page))
  if (params.limit)  qs.set('limit', String(params.limit))
  const res = await apiRequest<Wrapped<ListResponse>>(`/api/feriados?${qs.toString()}`)
  return res.data
}

export async function createFeriado(payload: FeriadoPayload): Promise<Feriado> {
  const res = await apiRequest<Wrapped<Feriado>>('/api/feriados', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateFeriado(id: number, payload: Partial<Feriado>): Promise<Feriado> {
  const res = await apiRequest<Wrapped<Feriado>>(`/api/feriados/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function deleteFeriado(id: number): Promise<void> {
  await apiRequest<Wrapped<void>>(`/api/feriados/${id}`, { method: 'DELETE' })
}

export interface FeriadoNacionalApiItem {
  data: string // YYYY-MM-DD
  nome: string
  recorrente: boolean
  ja_existe: boolean
}

/** Busca (sem gravar nada) os feriados nacionais do ano na BrasilAPI, pra mostrar numa lista. */
export async function fetchFeriadosNacionaisApi(ano: number): Promise<FeriadoNacionalApiItem[]> {
  const res = await apiRequest<Wrapped<FeriadoNacionalApiItem[]>>(`/api/feriados/nacionais-api?ano=${ano}`)
  return res.data
}

/** Importa um único feriado nacional escolhido na lista. */
export async function importarFeriadoNacionalApi(item: { data: string; nome: string }): Promise<{ id: number }> {
  const res = await apiRequest<Wrapped<{ id: number }>>('/api/feriados/nacionais-api/importar', {
    method: 'POST',
    body: JSON.stringify(item),
  })
  return res.data
}
