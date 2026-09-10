import { apiRequest, getApiBaseUrl, getStoredToken, ApiError } from '../lib/api'

export type ImportEntidade = 'lotacoes' | 'turnos' | 'funcionarios'

export type ImportErro = { linha: number; campo: string; mensagem: string }

export type FuncionarioImportado = { nome: string; email: string; cpf: string; senha_inicial: string }

export type ImportResultado = {
  importados: number
  funcionarios?: FuncionarioImportado[]
}

const ENDPOINTS: Record<ImportEntidade, string> = {
  lotacoes: '/api/lotacoes/importar',
  turnos: '/api/turnos/importar',
  funcionarios: '/api/funcionarios/importar',
}

const NOMES_ARQUIVO: Record<ImportEntidade, string> = {
  lotacoes: 'modelo-lotacoes.xlsx',
  turnos: 'modelo-tabela-horarios.xlsx',
  funcionarios: 'modelo-funcionarios.xlsx',
}

/** Baixa o modelo .xlsx da entidade e dispara o download no navegador. */
export async function baixarModelo(entidade: ImportEntidade): Promise<void> {
  const base = getApiBaseUrl()
  if (!base) throw new ApiError('Defina VITE_API_URL no arquivo .env na raiz do projeto.', 0)

  const token = getStoredToken()
  const res = await fetch(`${base}${ENDPOINTS[entidade]}/modelo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new ApiError('Erro ao baixar o modelo.', res.status)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = NOMES_ARQUIVO[entidade]
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function importarArquivo(entidade: ImportEntidade, arquivo: File): Promise<ImportResultado> {
  const formData = new FormData()
  formData.append('file', arquivo)
  const res = await apiRequest<{ data: ImportResultado }>(ENDPOINTS[entidade], {
    method: 'POST',
    body: formData,
  })
  return res.data
}
