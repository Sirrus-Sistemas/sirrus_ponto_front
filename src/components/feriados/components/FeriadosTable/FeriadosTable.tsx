import type { Feriado, FeriadoFilters, TipoFeriado } from '../../types'
import { FeriadoRow } from './FeriadoRow'
import styles from './FeriadosTable.module.css'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [String(ANO_ATUAL - 1), String(ANO_ATUAL), String(ANO_ATUAL + 1)]

interface FeriadosTableProps {
  rows: Feriado[]
  total: number
  loading: boolean
  filters: FeriadoFilters
  onFilterChange: (partial: Partial<FeriadoFilters>) => void
  onRemove: (id: number) => void
}

export function FeriadosTable({
  rows,
  total,
  loading,
  filters,
  onFilterChange,
  onRemove,
}: FeriadosTableProps) {
  return (
    <div className={styles.card}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.cardTitle}>Feriados cadastrados</span>
          <span className={styles.count}>
            {loading ? 'Carregando…' : `${rows.length} de ${total} feriados · ano ${filters.ano}`}
          </span>
        </div>

        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <SearchIcon />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Buscar por nome…"
              value={filters.q}
              onChange={(e) => onFilterChange({ q: e.target.value })}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={filters.tipo}
            onChange={(e) => onFilterChange({ tipo: e.target.value as TipoFeriado | 'todos' })}
          >
            <option value="todos">Todos os tipos</option>
            <option value="nacional">Nacional</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
            <option value="empresa">Empresarial</option>
          </select>
          <select
            className={styles.filterSelect}
            value={filters.ano}
            onChange={(e) => onFilterChange({ ano: e.target.value })}
          >
            {ANOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Local</th>
              <th>Recorrente</th>
              <th>Observação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>Carregando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>Nenhum feriado encontrado.</td>
              </tr>
            ) : (
              rows.map((f) => (
                <FeriadoRow key={f.id} feriado={f} onRemove={onRemove} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé */}
      <div className={styles.pagination}>
        <button className={styles.pgBtn} disabled>← Anterior</button>
        <span className={styles.pgInfo}>
          {rows.length} registros
        </span>
        <button className={styles.pgBtn} disabled>Próxima →</button>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}
