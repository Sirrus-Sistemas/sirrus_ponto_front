export type { TipoFeriado, Feriado, FeriadoPayload } from '../../services/feriadosApi'
import type { TipoFeriado } from '../../services/feriadosApi'

export interface FeriadoFilters {
  q: string;
  tipo: TipoFeriado | 'todos';
  ano: string;
}
