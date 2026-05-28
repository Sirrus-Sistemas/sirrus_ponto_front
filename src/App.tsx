import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { EspelhoPontoPage } from './components/dashboard/EspelhoPontoPage'
import { CadastroFuncionarioPage } from './components/funcionarios/CadastroFuncionarioPage'
import { CadastroDepartamentoPage } from './components/departamentos/CadastroDepartamentoPage'
import { CadastroTabelaHorariosPage } from './components/turnos/CadastroTabelaHorariosPage'
import { CadastroLotacoesPage } from './components/lotacoes/CadastroLotacoesPage'
import { CadastroFiliaisPage } from './components/filiais/CadastroFiliaisPage'
import { GerarEscalaPage } from './components/escalas/GerarEscalaPage'
import { AjustarEscalaPage } from './components/escalas/AjustarEscalaPage'
import { RelatorioEspelhoPage } from './components/relatorios/RelatorioEspelhoPage'
import { RelatoriosPage } from './components/relatorios/RelatoriosPage'
import { CadastroTiposOcorrenciaPage } from './components/ocorrencias/CadastroTiposOcorrenciaPage'
import { LancamentoOcorrenciaPage } from './components/ocorrencias/LancamentoOcorrenciaPage'
import { EspelhoPrintPage } from './components/relatorios/EspelhoPrintPage'
import { IntegracaoMobilePage } from './components/mobile/IntegracaoMobilePage'
import { CadastroMunicipioPage } from './components/municipios/CadastroMunicipioPage'
import { GerenciarUsuariosPage } from './components/usuarios/GerenciarUsuariosPage'
import { CadastroFeriadosPage } from './components/feriados/CadastroFeriadosPage'
import { FichaDePonto } from './pages/FichaDePonto/FichaDePonto'
import { LoginPage } from './components/login/LoginPage'
import { PasswordRecoveryPage } from './components/login/PasswordRecoveryPage'
import { getStoredToken } from './lib/api'
import { RequireAuth } from './routes/RequireAuth'

function CatchAllRedirect() {
  return <Navigate to={getStoredToken() ? '/dashboard' : '/'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/recuperar-senha" element={<PasswordRecoveryPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/relatorios/espelho/print" element={<EspelhoPrintPage />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/espelho" element={<EspelhoPontoPage />} />
            <Route path="/funcionarios" element={<CadastroFuncionarioPage />} />
            <Route path="/funcionarios/cadastro" element={<CadastroFuncionarioPage />} />
            <Route path="/departamentos" element={<CadastroDepartamentoPage />} />
            <Route path="/turnos" element={<CadastroTabelaHorariosPage />} />
            <Route path="/lotacoes" element={<CadastroLotacoesPage />} />
            <Route path="/escalas/gerar" element={<GerarEscalaPage />} />
            <Route path="/escalas/ajustar" element={<AjustarEscalaPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/relatorios/espelho" element={<RelatorioEspelhoPage />} />
            <Route path="/filiais" element={<CadastroFiliaisPage />} />
            <Route path="/ocorrencias/tipos" element={<CadastroTiposOcorrenciaPage />} />
            <Route path="/ocorrencias/lancamento" element={<LancamentoOcorrenciaPage />} />
            <Route path="/mobile/integracao" element={<IntegracaoMobilePage />} />
            <Route path="/municipios" element={<CadastroMunicipioPage />} />
            <Route path="/usuarios" element={<GerenciarUsuariosPage />} />
            <Route path="/feriados" element={<CadastroFeriadosPage />} />
            <Route path="/ficha-ponto" element={<FichaDePonto />} />
          </Route>
        </Route>

        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
