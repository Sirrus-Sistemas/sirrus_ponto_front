import { apiRequest } from '../lib/api'

export type EmpresaInfo = {
  id: number
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  cidade: string | null
  uf: string | null
  municipio_id: number | null
  municipio_nome: string | null
  municipio_estado: string | null
  municipio_fuso_horario: string | null
}

export async function fetchEmpresa(): Promise<EmpresaInfo> {
  const res = await apiRequest<{ success: boolean; data: EmpresaInfo }>('/api/empresa')
  return res.data
}

export async function updateEmpresaMunicipio(municipioId: number | null): Promise<void> {
  await apiRequest<{ success: boolean }>('/api/empresa/municipio', {
    method: 'PUT',
    body: JSON.stringify({ municipio_id: municipioId }),
  })
}
