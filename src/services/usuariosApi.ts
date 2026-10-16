import { apiRequest } from '../lib/api'

export type UsuarioAcesso = {
  id: number
  nome: string
  email: string | null
  role: string
  funcionario_ativo: number
  cpf: string | null
  usuario_ativo: number | null
  /** 1 = senha definida pelo admin/import, troca obrigatória no próximo login. */
  trocar_senha?: number | null
  tem_acesso: number
}

type ListResponse = { success?: boolean; data: UsuarioAcesso[] }
type SimpleResponse = { success?: boolean; data: unknown }

export async function fetchUsuarios(): Promise<UsuarioAcesso[]> {
  const res = await apiRequest<ListResponse>('/api/usuarios')
  return Array.isArray(res.data) ? res.data : []
}

export async function criarAcesso(
  funcionarioId: number,
  payload: { cpf: string; senha: string; role: string }
): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/usuarios/${funcionarioId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function atualizarAcesso(
  funcionarioId: number,
  payload: { role?: string; nova_senha?: string; cpf?: string; ativo?: number }
): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/usuarios/${funcionarioId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function revogarAcesso(funcionarioId: number): Promise<void> {
  await apiRequest<SimpleResponse>(`/api/usuarios/${funcionarioId}`, {
    method: 'DELETE',
  })
}

/** Mesma mensagem do backend — inativar a própria conta tranca o usuário fora do sistema. */
export const MSG_INATIVAR_PROPRIO_USUARIO =
  'Não é possível inativar o usuário que está logado. Solicite a outro administrador que realize essa alteração.'
