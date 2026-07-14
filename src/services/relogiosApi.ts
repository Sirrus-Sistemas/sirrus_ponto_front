import { apiRequest } from '../lib/api'

export const MODELOS_RELOGIO = [
  { value: 'arquivo_afd',          label: 'Arquivo AFD',            afd: true,  chave: 'pis' as const },
  { value: 'arquivo_afd_671',      label: 'Arquivo AFD 671',        afd: true,  chave: 'cpf' as const },
  { value: 'control_id',           label: 'Control ID',             afd: false, chave: 'pis' as const },
  { value: 'control_id_class',     label: 'Control ID Class',       afd: false, chave: 'pis' as const },
  { value: 'control_id_class_671', label: 'Control ID Class 671',   afd: false, chave: 'cpf' as const },
  { value: 'henry_super_facil',    label: 'Henry Super Fácil',      afd: false, chave: 'pis' as const },
  { value: 'henry_sf_advanced',    label: 'Henry SF Advanced',      afd: false, chave: 'pis' as const },
  { value: 'idface_671',           label: 'iDFace 671',             afd: false, chave: 'cpf' as const },
  { value: 'henry_1510',           label: 'Henry 1510',             afd: false, chave: 'pis' as const },
] as const

export type ModeloRelogio = typeof MODELOS_RELOGIO[number]['value']

export type Relogio = {
  id: number
  empresa_id: number
  filial_id: number | null
  filial_nome: string | null
  numero_serie: string
  descricao: string
  modelo: ModeloRelogio
  ip: string | null
  porta: number | null
  usuario: string | null
  senha: string | null
  usa_afd: boolean
  // Marcações anteriores a esta data são descartadas pelo sistema de
  // coleta local — evita importar anos de histórico de ex-funcionários de
  // relógios antigos.
  sincronizar_desde: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export type CreateRelogioPayload = {
  numero_serie: string
  descricao: string
  modelo: ModeloRelogio
  ip?: string | null
  porta?: number | null
  usuario?: string | null
  senha?: string | null
  usa_afd: boolean
  filial_id?: number | null
  sincronizar_desde: string
}

export type UpdateRelogioPayload = CreateRelogioPayload & { ativo: boolean }

type ApiEnvelope<T> = { success: boolean; data: T; message?: string }

export async function fetchRelogios(): Promise<Relogio[]> {
  const res = await apiRequest<ApiEnvelope<Relogio[]>>('/api/relogios')
  return res.data
}

export async function createRelogio(data: CreateRelogioPayload): Promise<Relogio> {
  const res = await apiRequest<ApiEnvelope<Relogio>>('/api/relogios', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function updateRelogio(id: number, data: UpdateRelogioPayload): Promise<Relogio> {
  const res = await apiRequest<ApiEnvelope<Relogio>>(`/api/relogios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function deleteRelogio(id: number): Promise<void> {
  await apiRequest(`/api/relogios/${id}`, { method: 'DELETE' })
}

export type ImportarAfdResumo = {
  total_linhas: number
  inserida: number
  duplicada: number
  pendente: number
}

export async function importarAfd(relogioId: number, arquivo: File): Promise<ImportarAfdResumo> {
  const formData = new FormData()
  formData.append('relogio_id', String(relogioId))
  formData.append('file', arquivo)

  const res = await apiRequest<ApiEnvelope<ImportarAfdResumo>>('/api/relogios/marcacoes/importar-afd', {
    method: 'POST',
    body: formData,
  })
  return res.data
}
