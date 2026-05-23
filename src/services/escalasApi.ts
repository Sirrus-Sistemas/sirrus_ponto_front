import { apiRequest } from '../lib/api'

export type TipoCiclo = '1x5' | '1x6' | '12x36' | '24x72' | '12x24x12x36'

export type EscalaPayload = {
  funcionario_id: number
  data_inicio: string
  data_fim: string
  tipo_ciclo: TipoCiclo
  inicio_ciclo: string
  entrada1?: string
  saida1?: string
  entrada2?: string
  saida2?: string
  entrada3?: string
  saida3?: string
  entrada4?: string
  saida4?: string
  fim_noturno?: string
}

export type DiaEscala = {
  data: string
  tipo: 'trabalho' | 'folga'
  entrada1: string | null
  saida1: string | null
  entrada2: string | null
  saida2: string | null
  entrada3: string | null
  saida3: string | null
  entrada4: string | null
  saida4: string | null
  fim_noturno: string | null
}

export type FuncionarioEscala = {
  id: number
  nome: string
  matricula: string | null
  cargo: string | null
  filial_nome: string | null
  departamento_nome: string | null
  turno_nome: string | null
  turno_entrada: string | null
  turno_saida: string | null
  saida_intervalo: string | null
  retorno_intervalo: string | null
}

export async function fetchFuncionariosComEscala(filialId?: number): Promise<FuncionarioEscala[]> {
  const params = filialId ? `?filial_id=${filialId}` : ''
  const res = await apiRequest<{ success: boolean; data: FuncionarioEscala[] }>(
    `/api/escalas/funcionarios${params}`
  )
  return res.data
}

export async function previewEscala(payload: EscalaPayload): Promise<DiaEscala[]> {
  const res = await apiRequest<{ success: boolean; data: DiaEscala[] }>('/api/escalas/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function salvarEscala(payload: EscalaPayload): Promise<number> {
  const res = await apiRequest<{ success: boolean; total: number }>('/api/escalas', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.total
}

export type AjusteDia = {
  data: string
  tipo: 'trabalho' | 'folga' | 'falta'
  entrada1?: string
  saida1?: string
  entrada2?: string
  saida2?: string
}

export async function updateDiaEscala(
  funcionarioId: number,
  ajuste: AjusteDia
): Promise<void> {
  await apiRequest<{ success: boolean }>('/api/escalas/ajuste', {
    method: 'POST',
    body: JSON.stringify({ funcionario_id: funcionarioId, ...ajuste }),
  })
}

export async function deleteEscala(
  funcionarioId: number,
  inicio: string,
  fim: string
): Promise<void> {
  const params = new URLSearchParams({
    funcionario_id: String(funcionarioId),
    inicio,
    fim,
  })
  await apiRequest<{ success: boolean }>(`/api/escalas?${params}`, {
    method: 'DELETE',
  })
}

export async function fetchEscala(
  funcionarioId: number,
  inicio: string,
  fim: string
): Promise<DiaEscala[]> {
  const res = await apiRequest<{ success: boolean; data: DiaEscala[] }>(
    `/api/escalas?funcionario_id=${funcionarioId}&inicio=${inicio}&fim=${fim}`
  )
  return res.data
}
