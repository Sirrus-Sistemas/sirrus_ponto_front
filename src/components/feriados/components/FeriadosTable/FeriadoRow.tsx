import type { Feriado } from '../../types'
import { TipoChip } from './TipoChip'
import styles from './FeriadosTable.module.css'

function formatData(f: Feriado): string {
  if (!f.data) return '—'
  if (f.recorrente) {
    // MM-DD
    const [mm, dd] = f.data.split('-')
    return `${dd}/${mm} (todo ano)`
  }
  // YYYY-MM-DD
  const [yyyy, mm, dd] = f.data.split('-')
  return `${dd}/${mm}/${yyyy}`
}

function formatLocal(f: Feriado): string {
  if ((f.tipo === 'estadual' || f.tipo === 'municipal') && f.uf) return f.uf
  return '—'
}

interface FeriadoRowProps {
  feriado: Feriado
  onRemove: (id: number) => void
}

export function FeriadoRow({ feriado: f, onRemove }: FeriadoRowProps) {
  return (
    <tr className={styles.row}>
      <td className={styles.tdNome}>{f.nome}</td>
      <td className={styles.tdData}>{formatData(f)}</td>
      <td><TipoChip tipo={f.tipo} /></td>
      <td className={styles.tdLocal}>{formatLocal(f)}</td>
      <td>
        {f.recorrente ? (
          <span className={styles.tagAnual}>
            <span className={styles.dot} />
            Anual
          </span>
        ) : (
          <span className={styles.tagUnico}>Único</span>
        )}
      </td>
      <td className={styles.tdObs}>{f.observacao || '—'}</td>
      <td>
        <button
          type="button"
          className={styles.btnTrash}
          aria-label={`Remover feriado ${f.nome}`}
          onClick={() => onRemove(f.id)}
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
