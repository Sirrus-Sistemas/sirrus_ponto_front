import { apiRequest } from '../lib/api'

export type Departamento = {
  id: number
  nome: string
  descricao?: string | null
  ativo?: number
  total_funcionarios?: number
}

export type { Turno } from './turnosApi'
export { fetchTurnos } from './turnosApi'

type ListaResponse<T> = {
  success?: boolean
  data: T
}

export async function fetchDepartamentos(): Promise<Departamento[]> {
  const res = await apiRequest<ListaResponse<Departamento[]>>('/api/departamentos')
  return Array.isArray(res.data) ? res.data : []
}

export type CreateDepartamentoPayload = {
  nome: string
  descricao?: string | null
}

type CreateDepartamentoResponse = {
  success?: boolean
  data: Record<string, unknown>
}

export async function createDepartamento(payload: CreateDepartamentoPayload): Promise<Record<string, unknown>> {
  const res = await apiRequest<CreateDepartamentoResponse>('/api/departamentos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export type UpdateDepartamentoPayload = Partial<{
  nome: string
  descricao: string | null
  ativo: number
}>

export async function updateDepartamento(id: number, payload: UpdateDepartamentoPayload): Promise<void> {
  await apiRequest(`/api/departamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
