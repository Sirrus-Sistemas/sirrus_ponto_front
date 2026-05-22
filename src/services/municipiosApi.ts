import { apiRequest } from '../lib/api'

export type Municipio = {
  CODMUNICIPIO: number
  NOMEMUNICIPIO: string
  ESTADO: string
  fuso_horario: string
}

type ListResponse = {
  success?: boolean
  data: {
    rows: Municipio[]
    total: number
    page: number
    limit: number
  }
}

type SimpleResponse = {
  success?: boolean
  data: unknown
}

export async function fetchMunicipios(params: {
  search?: string
  estado?: string
  page?: number
  limit?: number
}): Promise<{ rows: Municipio[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams()
  if (params.search)         qs.set('search', params.search)
  if (params.estado)         qs.set('estado', params.estado)
  if (params.page != null)   qs.set('page', String(params.page))
  if (params.limit != null)  qs.set('limit', String(params.limit))
  const res = await apiRequest<ListResponse>(`/api/municipios?${qs.toString()}`)
  return res.data
}

export async function createMunicipio(payload: {
  CODMUNICIPIO: number
  NOMEMUNICIPIO: string
  ESTADO: string
  fuso_horario?: string
}): Promise<void> {
  await apiRequest<SimpleResponse>('/api/municipios', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMunicipio(
  id: number,
  payload: Partial<Pick<Municipio, 'NOMEMUNICIPIO' | 'ESTADO' | 'fuso_horario'>>
): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/municipios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
