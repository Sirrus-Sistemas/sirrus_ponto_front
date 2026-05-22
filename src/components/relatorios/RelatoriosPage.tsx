import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RelatorioFuncionariosTab } from './RelatorioFuncionariosTab'
import { RelatorioFaltasTab } from './RelatorioFaltasTab'
import { RelatorioAtrasosTab } from './RelatorioAtrasosTab'
import { RelatorioOcorrenciasTab } from './RelatorioOcorrenciasTab'
import styles from './RelatoriosPage.module.css'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'espelho' | 'funcionarios' | 'faltas' | 'atrasos' | 'ocorrencias'

const TABS: { id: TabId; label: string }[] = [
  { id: 'espelho',      label: 'Folha de Ponto' },
  { id: 'funcionarios', label: 'Funcionários' },
  { id: 'faltas',       label: 'Faltas' },
  { id: 'atrasos',      label: 'Atrasos' },
  { id: 'ocorrencias',  label: 'Ocorrências' },
]

// ─── "Folha de Ponto" redirect tab ───────────────────────────────────────────

function EspelhoRedirectTab() {
  return (
    <div className={styles.redirectBox}>
      <p>
        O Espelho de Ponto é um relatório detalhado por funcionário. Clique abaixo para
        acessar a página de geração e impressão.
      </p>
      <Link to="/relatorios/espelho" className={styles.btnLink}>
        Ir para Espelho de Ponto
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabId>('espelho')

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>Relatórios</h1>
      <p className={styles.pageSubtitle}>Gere e imprima relatórios de ponto, funcionários, faltas, atrasos e ocorrências.</p>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className={styles.tabBar} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className={styles.tabContent} role="tabpanel">
        {activeTab === 'espelho'      && <EspelhoRedirectTab />}
        {activeTab === 'funcionarios' && <RelatorioFuncionariosTab />}
        {activeTab === 'faltas'       && <RelatorioFaltasTab />}
        {activeTab === 'atrasos'      && <RelatorioAtrasosTab />}
        {activeTab === 'ocorrencias'  && <RelatorioOcorrenciasTab />}
      </div>
    </div>
  )
}
