import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../lib/api'
import { fetchEspelho, type EspelhoPayload } from '../../services/espelhoApi'
import { fetchMe, type FuncionarioMe } from '../../services/userApi'
import { anoMesEspelhoPtBr } from './dashboardDiaUtils'
import { DashboardFuncionarioView } from './DashboardFuncionarioView'
import { DashboardGestorView } from './DashboardGestorView'
import styles from './DashboardPage.module.css'

type Visao = 'funcionario' | 'gestor'

export function DashboardPage() {
  const [me, setMe] = useState<FuncionarioMe | null>(null)
  const [espelho, setEspelho] = useState<EspelhoPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [visao, setVisao] = useState<Visao>('funcionario')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const isGestor = me?.role === 'admin' || me?.role === 'gestor'

  const reloadDados = useCallback(async () => {
    const { ano, mes } = anoMesEspelhoPtBr()
    const [meData, esp] = await Promise.all([fetchMe(), fetchEspelho(ano, mes)])
    setMe(meData)
    setEspelho(esp)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    reloadDados()
      .catch((e) => {
        if (!cancelled)
          setLoadError(e instanceof ApiError ? e.message : 'Não foi possível carregar o dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadDados])


  if (loading) {
    return (
      <div className={styles.pageState}>
        <p className={styles.pageLoading}>Carregando…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.pageState}>
        <p className={styles.pageError} role="alert">{loadError}</p>
      </div>
    )
  }

  const switcherNode = isGestor ? (
    <div className={styles.switcher}>
      <button
        type="button"
        className={styles.switcherBtn}
        onClick={() => setDropdownOpen((o) => !o)}
      >
        Visão <strong>{visao === 'funcionario' ? 'Funcionário' : 'Gestor'}</strong>
        <span className={styles.switcherChev} aria-hidden>▾</span>
      </button>
      {dropdownOpen && (
        <div className={styles.switcherMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={`${styles.switcherItem} ${visao === 'funcionario' ? styles.switcherItemActive : ''}`}
            onClick={() => { setVisao('funcionario'); setDropdownOpen(false) }}
          >
            Funcionário
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.switcherItem} ${visao === 'gestor' ? styles.switcherItemActive : ''}`}
            onClick={() => { setVisao('gestor'); setDropdownOpen(false) }}
          >
            Gestor
          </button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className={styles.wrap}>
      {(!isGestor || visao === 'funcionario') && me && espelho && (
        <DashboardFuncionarioView
          me={me}
          espelho={espelho}
          switcherNode={switcherNode}
        />
      )}

      {isGestor && visao === 'gestor' && me && (
        <DashboardGestorView me={me} switcherNode={switcherNode} />
      )}
    </div>
  )
}
