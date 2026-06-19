import { apiRequest } from '../lib/api'

export type Filial = {
  id: number
  empresa_id?: number
  nome: string
  tipo_documento?: 'cnpj' | 'cpf' | null
  cnpj?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  telefone?: string | null
  email?: string | null
  num_registradora?: string | null
  ativa?: number
  total_funcionarios?: number
  updated_at?: string | null
}

type ListaResponse<T> = { success?: boolean; data: T }

export async function fetchFiliais(): Promise<Filial[]> {
  const res = await apiRequest<ListaResponse<Filial[]>>('/api/filiais')
  return Array.isArray(res.data) ? res.data : []
}

export type CreateFilialPayload = {
  nome: string
  tipo_documento?: 'cnpj' | 'cpf' | null
  cnpj?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  telefone?: string | null
  email?: string | null
  num_registradora?: string | null
}

export async function createFilial(payload: CreateFilialPayload): Promise<Record<string, unknown>> {
  const res = await apiRequest<ListaResponse<Record<string, unknown>>>('/api/filiais', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export type UpdateFilialPayload = Partial<CreateFilialPayload & { ativa: number }>

export async function updateFilial(id: number, payload: UpdateFilialPayload): Promise<void> {
  await apiRequest(`/api/filiais/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
