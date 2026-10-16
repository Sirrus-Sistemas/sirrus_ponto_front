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

export type SyncJobStatus = {
  status: 'em_andamento' | 'concluido' | 'erro'
  total: number
  processados: number
  sincronizados: number
  erros: { funcionario_id: number; error: string }[]
  sucessos: { funcionario_id: number; pontomobile_id: number }[]
  erro_geral: string | null
}

export type ConflitoPontomobileId = {
  pontomobile_id: number
  funcionarios: { id: number; nome: string; cpf?: string | null }[]
}

export type PullResult = {
  importados: number
  ignorados: number
  erros: { id: number; error: string }[]
  conflitos_pontomobile_id?: ConflitoPontomobileId[]
}

export async function fetchMobileStatus(): Promise<{ configurado: boolean }> {
  const r = await apiRequest<{ data: { configurado: boolean } }>('/api/mobile/status')
  return r.data
}

export async function fetchMobileFiliais(): Promise<FilialMobileItem[]> {
  const r = await apiRequest<{ data: FilialMobileItem[] }>('/api/mobile/filiais')
  return r.data
}

/** Funcionários ativos que compartilham o mesmo pontomobile_id — nunca deveria acontecer. */
export async function fetchConflitosPontomobileId(): Promise<ConflitoPontomobileId[]> {
  const r = await apiRequest<{ data: ConflitoPontomobileId[] }>('/api/mobile/conflitos-pontomobile-id')
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

export async function syncAllFuncionarios(filtro: { filialId?: number; lotacaoId?: number } = {}): Promise<{ job_id: string }> {
  const r = await apiRequest<{ data: { job_id: string } }>('/api/mobile/sync/funcionarios', {
    method: 'POST',
    body: JSON.stringify({
      ...(filtro.filialId ? { filial_id: filtro.filialId } : {}),
      ...(filtro.lotacaoId ? { lotacao_id: filtro.lotacaoId } : {}),
    }),
  })
  return r.data
}

export async function fetchSyncJobStatus(jobId: string): Promise<SyncJobStatus> {
  const r = await apiRequest<{ data: SyncJobStatus }>(`/api/mobile/sync/funcionarios/${jobId}`)
  return r.data
}

export async function pullMarcacoes(
  filialId: number,
  dataInicio: string,
  dataFim: string,
  lotacaoId?: number,
  funcionarioId?: number,
): Promise<PullResult> {
  const r = await apiRequest<{ data: PullResult }>('/api/mobile/pull-marcacoes', {
    method: 'POST',
    body: JSON.stringify({
      filial_id: filialId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      ...(lotacaoId ? { lotacao_id: lotacaoId } : {}),
      ...(funcionarioId ? { funcionario_id: funcionarioId } : {}),
    }),
  })
  return r.data
}

/**
 * Redefine a senha do funcionário no app Ponto Mobile. `aplicada` = já foi
 * enviada ao app; false = funcionário ainda não sincronizado (a senha vai na
 * criação, na próxima sincronização).
 */
export async function redefinirSenhaMobile(funcionarioId: number, senha: string): Promise<{ aplicada: boolean; message?: string }> {
  const r = await apiRequest<{ data: { aplicada: boolean }; message?: string }>(
    `/api/mobile/funcionarios/${funcionarioId}/senha`,
    { method: 'POST', body: JSON.stringify({ senha }) },
  )
  return { aplicada: r.data.aplicada, message: r.message }
}

export type ImportacaoCercas = {
  importados: number
  ja_configurados: number
  sem_cerca: number
  nao_encontrados: number
  erros: { filial_id: number; error: string }[]
}

/** Traz as cercas eletrônicas que já existem no app para os funcionários daqui (sem sobrescrever). */
export async function importarCercasDoMobile(): Promise<{ resultado: ImportacaoCercas; message?: string }> {
  const r = await apiRequest<{ data: ImportacaoCercas; message?: string }>('/api/mobile/cercas/importar', { method: 'POST' })
  return { resultado: r.data, message: r.message }
}
