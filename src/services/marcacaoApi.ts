import { apiRequest } from '../lib/api'

export type MarcacaoRegistrada = {
  id: number
  data_hora: string
  tipo: string
}

type RegistrarResponse = {
  success?: boolean
  data: MarcacaoRegistrada
}

/** Registra batida no servidor (horário = NOW no banco). */
export async function registrarMarcacao(tipo: 'online' = 'online'): Promise<MarcacaoRegistrada> {
  const res = await apiRequest<RegistrarResponse>('/api/marcacoes', {
    method: 'POST',
    body: JSON.stringify({ tipo }),
  })
  return res.data
}
