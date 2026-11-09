import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import type { AppShellOutletContext } from './appShellContext'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clearStoredToken } from '../../lib/api'
import { logoutRequest } from '../../services/authApi'
import { fetchMe, type FuncionarioMe } from '../../services/userApi'
import { fetchEmpresa } from '../../services/empresaApi'
import styles from './AppShell.module.css'

const SIDEBAR_COLLAPSED_KEY = 'sp_sidebar_collapsed'

function navClass(isActive: boolean) {
  return `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
}

export function AppShell() {
  const navigate = useNavigate()
  const [me, setMe] = useState<FuncionarioMe | null>(null)
  const [meReady, setMeReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [aprovacaoMobileAtiva, setAprovacaoMobileAtiva] = useState(false)
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
    if (me?.role !== 'admin') { setAprovacaoMobileAtiva(false); return }
    let cancelled = false
    fetchEmpresa()
      .then((emp) => { if (!cancelled) setAprovacaoMobileAtiva(Number(emp.aprovacao_mobile_ativa) === 1) })
      .catch(() => { if (!cancelled) setAprovacaoMobileAtiva(false) })
    return () => { cancelled = true }
  }, [me?.role])

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

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* localStorage indisponível — preferência só não persiste */
    }
  }, [collapsed])

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

  const isFullBleed = !!useMatch('/ficha-ponto')

  const podeCadastrarFuncionario = me?.role === 'admin' || me?.role === 'gestor'
  const podeGerarEscala = me?.role === 'admin' || me?.role === 'gestor'
  const podeFichaPonto = me?.role === 'admin' || me?.role === 'gestor'
  const podeRelatorios = me?.role === 'admin' || me?.role === 'gestor'
  const podeGerirDepartamentos = me?.role === 'admin'
  const podeGerirTabelaHorarios = me?.role === 'admin'
  const podeGerirLotacoes = me?.role === 'admin'
  const podeGerirFiliais = me?.role === 'admin'
  const podeGerirTiposOcorrencia = me?.role === 'admin'
  const podeGerirMunicipios = me?.role === 'admin'
  const podeGerirFeriados = me?.role === 'admin'
  const podeGerirUsuarios = me?.role === 'admin'
  const outletCtx: AppShellOutletContext = { me, meReady }

  function closeMobileMenu() {
    setSidebarOpen(false)
  }

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
          className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''} ${collapsed ? styles.sidebarCollapsed : ''}`}
          aria-label="Menu principal"
        >
          <button
            type="button"
            className={styles.collapseBtn}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={() => setCollapsed((c) => !c)}
          >
            <ChevronIcon collapsed={collapsed} />
          </button>

          <div className={styles.sidebarTop}>
            <Link to="/dashboard" className={styles.sidebarBrand} onClick={closeMobileMenu}>
              <img src="/logo-sirrus.svg" alt="" className={styles.sidebarLogo} aria-hidden />
              <span className={styles.sidebarBrandNames}>
                <span className={styles.sidebarBrandText}>Sirrus Ponto</span>
                <span className={styles.sidebarBrandSub}>Sistemas Empresariais</span>
              </span>
            </Link>
          </div>

          <nav className={styles.sidebarNav}>
            {/* ── Dashboard ─────────────────────────────────────── */}
            <NavItem to="/dashboard" end icon={<IconDashboard />} label="Dashboard" onNavigate={closeMobileMenu} />

            {/* ── Movimentações ─────────────────────────────────── */}
            <div className={styles.navSection}>Movimentações</div>
            <NavItem to="/espelho" icon={<IconEspelho />} label="Espelho de Ponto" onNavigate={closeMobileMenu} />
            {podeFichaPonto ? (
              <NavItem to="/ficha-ponto" icon={<IconFicha />} label="Ficha de Ponto" onNavigate={closeMobileMenu} />
            ) : null}
            {podeFichaPonto ? (
              <NavItem to="/banco-horas" icon={<IconBancoHoras />} label="Banco de Horas" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerarEscala ? (
              <NavItem to="/escalas/gerar" icon={<IconEscala />} label="Gerar Escala" onNavigate={closeMobileMenu} />
            ) : null}
            {podeRelatorios ? (
              <NavItem to="/relatorios" icon={<IconRelatorio />} label="Relatórios" onNavigate={closeMobileMenu} />
            ) : null}
            {podeRelatorios ? (
              <NavItem to="/arquivos-mte" icon={<IconRelatorio />} label="Arquivos MTE" onNavigate={closeMobileMenu} />
            ) : null}

            {/* ── Cadastro ──────────────────────────────────────── */}
            {podeCadastrarFuncionario ? (
              <div className={styles.navSection}>Cadastro</div>
            ) : null}
            {podeCadastrarFuncionario ? (
              <NavItem to="/funcionarios" icon={<IconUsers />} label="Funcionários" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirDepartamentos ? (
              <NavItem to="/departamentos" icon={<IconBuilding />} label="Departamentos" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirTiposOcorrencia ? (
              <NavItem to="/ocorrencias/tipos" icon={<IconTipoOcorrencia />} label="Tipos de Ocorrência" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirTabelaHorarios ? (
              <NavItem to="/turnos" icon={<IconSchedule />} label="Tabela de Horários" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirFiliais ? (
              <NavItem to="/filiais" icon={<IconFilial />} label="Filiais" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirLotacoes ? (
              <NavItem to="/lotacoes" icon={<IconLotacao />} label="Lotações" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirMunicipios ? (
              <NavItem to="/municipios" icon={<IconMapa />} label="Municípios" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirFeriados ? (
              <NavItem to="/feriados" icon={<IconFeriado />} label="Feriados" onNavigate={closeMobileMenu} />
            ) : null}
            {podeGerirUsuarios ? (
              <NavItem to="/usuarios" icon={<IconUsuario />} label="Usuários do Sistema" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/configuracoes/empresa" icon={<IconConfigEmpresa />} label="Configuração da Empresa" onNavigate={closeMobileMenu} />
            ) : null}

            {/* ── Integrações ───────────────────────────────────── */}
            {me?.role === 'admin' ? (
              <div className={styles.navSection}>Integrações</div>
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/mobile/integracao" icon={<IconMobile />} label="Ponto Mobile" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' && aprovacaoMobileAtiva ? (
              <NavItem to="/mobile/aprovacao" icon={<IconAprovacao />} label="Aprovação de Batidas" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/mobile/aprovacao-ocorrencias" icon={<IconTipoOcorrencia />} label="Aprovação de Ocorrências" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/relogios" icon={<IconRelogio />} label="Relógios de Ponto" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/relogios/comunicacao" icon={<IconComunicacao />} label="Comunicação Equipamentos" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/relogios/marcacoes-pendentes" icon={<IconComunicacao />} label="Marcações Pendentes" onNavigate={closeMobileMenu} />
            ) : null}
            {me?.role === 'admin' ? (
              <NavItem to="/relogios/importar-afd" icon={<IconComunicacao />} label="Importar AFD" onNavigate={closeMobileMenu} />
            ) : null}
          </nav>

          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarUser}>
              <div className={styles.sidebarUserAvatar} aria-hidden title={me?.nome ?? '—'}>
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
            <button
              type="button"
              className={styles.sidebarLogout}
              onClick={() => void logout()}
              title="Sair"
            >
              <span className={styles.logoutIcon} aria-hidden><IconLogout /></span>
              <span className={styles.logoutLabel}>Sair</span>
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

interface NavItemProps {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
  onNavigate: () => void
}

function NavItem({ to, icon, label, end, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => navClass(isActive)}
      onClick={onNavigate}
      title={label}
    >
      <span className={styles.navIcon} aria-hidden>{icon}</span>
      <span className={styles.navLabel}>{label}</span>
    </NavLink>
  )
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function IconBancoHoras() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2h6" strokeLinecap="round" />
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

function IconConfigEmpresa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRelogio() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconComunicacao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 9h8M8 13h6" strokeLinecap="round" />
      <path d="M20 2H4a2 2 0 00-2 2v14l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAprovacao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
