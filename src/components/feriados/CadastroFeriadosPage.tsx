import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppShellOutletContext } from '../layout/appShellContext'
import { useFeriados } from './useFeriados'
import { FeriadoForm } from './components/FeriadoForm/FeriadoForm'
import { FeriadosTable } from './components/FeriadosTable/FeriadosTable'
import { ImportarFeriadosModal } from './components/ImportarFeriadosModal/ImportarFeriadosModal'
import styles from './CadastroFeriadosPage.module.css'

export function CadastroFeriadosPage() {
  const { meReady } = useOutletContext<AppShellOutletContext>()
  const { rows, total, loading, error, filters, updateFilters, add, remove } = useFeriados()
  const [importarAberto, setImportarAberto] = useState(false)

  if (!meReady) {
    return <p className={styles.loading}>Carregando…</p>
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Localização">
        <span className={styles.breadcrumbItem}>Cadastro</span>
        <span className={styles.breadcrumbSep} aria-hidden>/</span>
        <span className={styles.breadcrumbCurrent}>Feriados</span>
      </nav>

      {/* Cabeçalho */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderTop}>
          <div>
            <h1 className={styles.title}>Feriados</h1>
            <p className={styles.subtitle}>
              Cadastre feriados nacionais, estaduais, municipais e empresariais usados no cálculo de escalas e jornadas.
            </p>
          </div>
          <button type="button" className={styles.btnImportar} onClick={() => setImportarAberto(true)}>
            Importar feriados
          </button>
        </div>
      </div>

      {importarAberto && (
        <ImportarFeriadosModal
          onClose={() => setImportarAberto(false)}
          onImportado={() => updateFilters({})}
        />
      )}

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {/* Grid 2 colunas */}
      <div className={styles.grid}>
        <FeriadoForm onSubmit={add} />
        <FeriadosTable
          rows={rows}
          total={total}
          loading={loading}
          filters={filters}
          onFilterChange={updateFilters}
          onRemove={remove}
        />
      </div>
    </div>
  )
}
