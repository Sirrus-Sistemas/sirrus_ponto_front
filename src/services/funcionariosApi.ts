import { apiRequest } from '../lib/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CreateFuncionarioPayload = {
  nome: string
  email: string
  /** 11 dígitos, sem máscara */
  cpf: string
  data_admissao: string
  password: string
  telefone?: string | null
  cargo?: string | null
  matricula?: string | null
  pis?: string | null
  filial_id?: number | null
  departamento_id?: number | null
  turno_id?: number | null
  lotacao_id?: number | null
  gestor_id?: number | null
  role?: 'admin' | 'gestor' | 'funcionario'
  usa_escala?: number
  usa_mobile?: number
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  municipio_id?: number | null
}

export type UpdateFuncionarioPayload = {
  nome?: string
  email?: string
  telefone?: string | null
  cargo?: string | null
  matricula?: string | null
  pis?: string | null
  data_admissao?: string
  filial_id?: number | null
  departamento_id?: number | null
  turno_id?: number | null
  lotacao_id?: number | null
  role?: 'admin' | 'gestor' | 'funcionario'
  ativo?: number
  usa_escala?: number
  usa_mobile?: number
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  municipio_id?: number | null
}

export type FuncionarioListItem = {
  id: number
  nome: string
  email: string
  cpf: string | null
  cargo: string | null
  matricula: string | null
  role: 'admin' | 'gestor' | 'funcionario'
  ativo: number
  usa_escala: number
  filial_id: number | null
  lotacao_id: number | null
  filial_nome: string | null
  departamento_nome: string | null
  turno_nome: string | null
  lotacao_nome: string | null
  data_admissao: string
}

export type FuncionarioDetail = {
  id: number
  nome: string
  email: string
  cpf: string | null
  telefone: string | null
  cargo: string | null
  matricula: string | null
  pis: string | null
  data_admissao: string
  filial_id: number | null
  departamento_id: number | null
  turno_id: number | null
  lotacao_id: number | null
  gestor_id: number | null
  role: 'admin' | 'gestor' | 'funcionario'
  ativo: number
  usa_escala: number
  usa_mobile: number
  pontomobile_id: number | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  municipio_id: number | null
  fuso_horario: string | null
}

export type FuncionariosPagination = {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchFuncionarios(params?: {
  search?: string
  page?: number
  limit?: number
  ativo?: number
  lotacao_id?: number
  filial_id?: number
}): Promise<{ data: FuncionarioListItem[]; pagination: FuncionariosPagination }> {
  const qs = new URLSearchParams()
  if (params?.search)                qs.set('search', params.search)
  if (params?.page)                  qs.set('page', String(params.page))
  if (params?.limit)                 qs.set('limit', String(params.limit))
  if (params?.ativo !== undefined)   qs.set('ativo', String(params.ativo))
  if (params?.lotacao_id != null)    qs.set('lotacao_id', String(params.lotacao_id))
  if (params?.filial_id != null)     qs.set('filial_id', String(params.filial_id))
  const query = qs.toString() ? `?${qs}` : ''
  return apiRequest<{ data: FuncionarioListItem[]; pagination: FuncionariosPagination }>(
    `/api/funcionarios${query}`
  )
}

export async function fetchFuncionarioById(id: number): Promise<FuncionarioDetail> {
  const res = await apiRequest<{ data: FuncionarioDetail }>(`/api/funcionarios/${id}`)
  return res.data
}

export async function createFuncionario(
  payload: CreateFuncionarioPayload
): Promise<Record<string, unknown>> {
  const res = await apiRequest<{ data: Record<string, unknown> }>('/api/funcionarios', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateFuncionario(
  id: number,
  payload: UpdateFuncionarioPayload
): Promise<void> {
  await apiRequest<unknown>(`/api/funcionarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
