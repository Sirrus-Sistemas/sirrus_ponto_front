import { apiRequest } from '../lib/api'

export type FilialMobileItem = {
  id: number
  nome: string
  cnpj: string | null
  pontomobile_id: number | null
  ativa: number
}

export type SyncAllResult = {
  sincronizados: number
  erros: { funcionario_id: number; error: string }[]
}

export type PullResult = {
  importados: number
  ignorados: number
  erros: { id: number; error: string }[]
}

export async function fetchMobileStatus(): Promise<{ configurado: boolean }> {
  const r = await apiRequest<{ data: { configurado: boolean } }>('/api/mobile/status')
  return r.data
}

export async function fetchMobileFiliais(): Promise<FilialMobileItem[]> {
  const r = await apiRequest<{ data: FilialMobileItem[] }>('/api/mobile/filiais')
  return r.data
}

export async function syncFilial(id: number): Promise<{ filial_id: number; pontomobile_id: number }> {
  const r = await apiRequest<{ data: { filial_id: number; pontomobile_id: number } }>(
    `/api/mobile/sync/filial/${id}`,
    { method: 'POST' },
  )
  return r.data
}

export async function syncFuncionario(id: number): Promise<{ funcionario_id: number; pontomobile_id: number }> {
  const r = await apiRequest<{ data: { funcionario_id: number; pontomobile_id: number } }>(
    `/api/mobile/sync/funcionario/${id}`,
    { method: 'POST' },
  )
  return r.data
}

export async function syncAllFuncionarios(filialId?: number): Promise<SyncAllResult> {
  const r = await apiRequest<{ data: SyncAllResult }>('/api/mobile/sync/funcionarios', {
    method: 'POST',
    body: JSON.stringify(filialId ? { filial_id: filialId } : {}),
  })
  return r.data
}

export async function pullMarcacoes(
  filialId: number,
  dataInicio: string,
  dataFim: string,
  lotacaoId?: number,
): Promise<PullResult> {
  const r = await apiRequest<{ data: PullResult }>('/api/mobile/pull-marcacoes', {
    method: 'POST',
    body: JSON.stringify({
      filial_id: filialId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      ...(lotacaoId ? { lotacao_id: lotacaoId } : {}),
    }),
  })
  return r.data
}
