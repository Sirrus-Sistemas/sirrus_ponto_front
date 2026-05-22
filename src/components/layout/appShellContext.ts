import type { FuncionarioMe } from '../../services/userApi'

export type AppShellOutletContext = {
  me: FuncionarioMe | null
  /** `true` quando o GET /api/funcionarios/me terminou (sucesso ou erro). */
  meReady: boolean
}
