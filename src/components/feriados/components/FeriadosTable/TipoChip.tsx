import type { TipoFeriado } from '../../types'
import styles from './FeriadosTable.module.css'

const LABELS: Record<TipoFeriado, string> = {
  nacional:  'Nacional',
  estadual:  'Estadual',
  municipal: 'Municipal',
  empresa:   'Empresarial',
}

const CHIP_MOD: Record<TipoFeriado, string> = {
  nacional:  styles.chipNacional,
  estadual:  styles.chipEstadual,
  municipal: styles.chipMunicipal,
  empresa:   styles.chipEmpresarial,
}

export function TipoChip({ tipo }: { tipo: TipoFeriado }) {
  return (
    <span className={`${styles.chip} ${CHIP_MOD[tipo]}`}>
      {LABELS[tipo]}
    </span>
  )
}
