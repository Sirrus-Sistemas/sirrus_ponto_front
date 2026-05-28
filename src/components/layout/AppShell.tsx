import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import type { AppShellOutletContext } from './appShellContext'
import { useEffect, useRef, useState } from 'react'
import { clearStoredToken } from '../../lib/api'
import { logoutRequest } from '../../services/authApi'
import { fetchMe, type FuncionarioMe } from '../../services/userApi'
import styles from './AppShell.module.css'

export function AppShell() {
  const navigate = useNavigate()
  const [me, setMe] = useState<FuncionarioMe | null>(null)
  const [meReady, setMeReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setMeReady(false)
    fetchMe()
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
      .finally(() => {
        if (!cancelled) setMeReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    function onResize() {
      if (window.matchMedia('(min-width: 901px)').matches) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function logout() {
    try {
      await logoutRequest()
    } catch {
      /* sessão já inválida ou rede — segue limpando local */
    }
    clearStoredToken()
    setMenuOpen(false)
    setSidebarOpen(false)
    navigate('/', { replace: true })
  }

  const initial = me?.nome?.trim()?.charAt(0)?.toUpperCase() ?? '?'

  function navClass(isActive: boolean) {
    return `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
  }

  const isFullBleed = !!useMatch('/ficha-ponto')

  const podeCadastrarFuncionario = me?.role === 'admin' || me?.role === 'gestor'
  const podeGerarEscala = me?.role === 'admin' || me?.role === 'gestor'
  const podeFichaPonto = me?.role === 'admin' || me?.role === 'gestor'
  const podeRelatorios = me?.role === 'admin' || me?.role === 'gestor'
  const podeLancarOcorrencia = me?.role === 'admin' || me?.role === 'gestor'
  const podeGerirDepartamentos = me?.role === 'admin'
  const podeGerirTabelaHorarios = me?.role === 'admin'
  const podeGerirLotacoes = me?.role === 'admin'
  const podeGerirFiliais = me?.role === 'admin'
  const podeGerirTiposOcorrencia = me?.role === 'admin'
  const podeGerirMunicipios = me?.role === 'admin'
  const podeGerirFeriados = me?.role === 'admin'
  const podeGerirUsuarios = me?.role === 'admin'
  const outletCtx: AppShellOutletContext = { me, meReady }

  return (
    <div className={styles.root}>
      {sidebarOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className={styles.shellRow}>
        <aside
          className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
          aria-label="Menu principal"
        >
          <div className={styles.sidebarTop}>
            <Link to="/dashboard" className={styles.sidebarBrand} onClick={() => setSidebarOpen(false)}>
              <img src="/logo-sirrus.svg" alt="" className={styles.sidebarLogo} aria-hidden />
              <span className={styles.sidebarBrandNames}>
                <span className={styles.sidebarBrandText}>Sirrus Ponto</span>
                <span className={styles.sidebarBrandSub}>Sistemas Empresariais</span>
              </span>
            </Link>
          </div>

          <nav className={styles.sidebarNav}>
            {/* ── Dashboard ─────────────────────────────────────── */}
            <NavLink
              to="/dashboard"
              className={({ isActive }) => navClass(isActive)}
              end
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon} aria-hidden><IconDashboard /></span>
              Dashboard
            </NavLink>

            {/* ── Movimentações ─────────────────────────────────── */}
            <div className={styles.navSection}>Movimentações</div>
            <NavLink
              to="/espelho"
              className={({ isActive }) => navClass(isActive)}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon} aria-hidden><IconEspelho /></span>
              Espelho de Ponto
            </NavLink>
            {podeFichaPonto ? (
              <NavLink
                to="/ficha-ponto"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconFicha /></span>
                Ficha de Ponto
              </NavLink>
            ) : null}
            {podeGerarEscala ? (
              <NavLink
                to="/escalas/gerar"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconEscala /></span>
                Gerar Escala
              </NavLink>
            ) : null}
            {podeLancarOcorrencia ? (
              <NavLink
                to="/ocorrencias/lancamento"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconOcorrencia /></span>
                Ocorrências
              </NavLink>
            ) : null}
            {podeRelatorios ? (
              <NavLink
                to="/relatorios"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconRelatorio /></span>
                Relatórios
              </NavLink>
            ) : null}

            {/* ── Cadastro ──────────────────────────────────────── */}
            {podeCadastrarFuncionario ? (
              <div className={styles.navSection}>Cadastro</div>
            ) : null}
            {podeCadastrarFuncionario ? (
              <NavLink
                to="/funcionarios"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconUsers /></span>
                Funcionários
              </NavLink>
            ) : null}
            {podeGerirDepartamentos ? (
              <NavLink
                to="/departamentos"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconBuilding /></span>
                Departamentos
              </NavLink>
            ) : null}
            {podeGerirTiposOcorrencia ? (
              <NavLink
                to="/ocorrencias/tipos"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconTipoOcorrencia /></span>
                Tipos de Ocorrência
              </NavLink>
            ) : null}
            {podeGerirTabelaHorarios ? (
              <NavLink
                to="/turnos"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconSchedule /></span>
                Tabela de Horários
              </NavLink>
            ) : null}
            {podeGerirFiliais ? (
              <NavLink
                to="/filiais"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconFilial /></span>
                Filiais
              </NavLink>
            ) : null}
            {podeGerirLotacoes ? (
              <NavLink
                to="/lotacoes"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconLotacao /></span>
                Lotações
              </NavLink>
            ) : null}
            {podeGerirMunicipios ? (
              <NavLink
                to="/municipios"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconMapa /></span>
                Municípios
              </NavLink>
            ) : null}
            {podeGerirFeriados ? (
              <NavLink
                to="/feriados"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconFeriado /></span>
                Feriados
              </NavLink>
            ) : null}
            {podeGerirUsuarios ? (
              <NavLink
                to="/usuarios"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconUsuario /></span>
                Usuários do Sistema
              </NavLink>
            ) : null}

            {/* ── Integrações ───────────────────────────────────── */}
            {me?.role === 'admin' ? (
              <div className={styles.navSection}>Integrações</div>
            ) : null}
            {me?.role === 'admin' ? (
              <NavLink
                to="/mobile/integracao"
                className={({ isActive }) => navClass(isActive)}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon} aria-hidden><IconMobile /></span>
                Ponto Mobile
              </NavLink>
            ) : null}
          </nav>

          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarUser}>
              <div className={styles.sidebarUserAvatar} aria-hidden>
                {me?.foto_path ? (
                  <img src={me.foto_path} alt="" className={styles.sidebarUserAvatarImg} />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className={styles.sidebarUserInfo}>
                <span className={styles.sidebarUserName}>{me?.nome ?? '—'}</span>
                <span className={styles.sidebarUserSub}>
                  {[me?.cargo, me?.departamento_nome].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            </div>
            <button type="button" className={styles.sidebarLogout} onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </aside>

        <div className={styles.rightCol}>
          <header className={styles.header}>
            <button
              type="button"
              className={styles.menuBurger}
              aria-label="Abrir menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <BurgerIcon />
            </button>

            <div className={styles.headerSpacer} />

            <div className={styles.actions}>
              <button type="button" className={styles.iconBtn} aria-label="Notificações">
                <BellIcon />
              </button>
              <div className={styles.menuWrap} ref={menuRef}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Menu da conta"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen((o) => !o)
                  }}
                >
                  <DotsIcon />
                </button>
                {menuOpen ? (
                  <div className={styles.dropdown} role="menu">
                    <button type="button" className={styles.dropdownItem} role="menuitem" onClick={() => void logout()}>
                      Sair
                    </button>
                  </div>
                ) : null}
              </div>
              <div className={styles.avatar} aria-hidden title={me?.nome ?? 'Usuário'}>
                {me?.foto_path ? (
                  <img src={me.foto_path} alt="" className={styles.avatarImg} />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
            </div>
          </header>

          <main className={isFullBleed ? styles.mainFull : styles.main}>
            {isFullBleed ? (
              <Outlet context={outletCtx} />
            ) : (
              <div className={styles.mainInner}>
                <Outlet context={outletCtx} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}


function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

function IconEspelho() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 22V12h6v10M9 7h.01M12 7h.01M15 7h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconSchedule() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <path d="M9 16h.01M12 16h.01M15 16h.01" strokeLinecap="round" />
    </svg>
  )
}

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" strokeLinecap="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}

function IconFilial() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" strokeLinecap="round" />
    </svg>
  )
}

function IconEscala() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <path d="M8 14h2v4H8z" />
      <path d="M14 14h2v2h-2z" />
    </svg>
  )
}

function IconRelatorio() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  )
}

function IconFicha() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <path d="M8 14h2M14 14h2M8 18h2M14 18h2" strokeLinecap="round" />
    </svg>
  )
}

function IconLotacao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  )
}

function IconOcorrencia() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconMobile() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M12 18h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconMapa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function IconUsuario() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      <path d="M16 3.5a4 4 0 010 9" strokeLinecap="round" />
      <path d="M20 14c1.5.8 2.5 2.3 2.5 4" strokeLinecap="round" />
    </svg>
  )
}

function IconFeriado() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconTipoOcorrencia() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h2M9 16h2M13 12l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
