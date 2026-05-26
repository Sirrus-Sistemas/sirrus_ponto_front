import { ChevronDown, RefreshCw } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import styles from './FilterBar.module.css';
import type { Employee } from '../../types';
import type { FuncionarioListItem } from '../../../../services/funcionariosApi';
import type { Lotacao } from '../../../../services/lotacoesApi';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

interface FilterBarProps {
  employee: Employee | null;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  onStartMonthChange: (month: number, year: number) => void;
  onEndMonthChange: (month: number, year: number) => void;
  funcionarios: FuncionarioListItem[];
  selectedFuncId: number | undefined;
  onFuncChange: (id: number | undefined) => void;
  lotacoes: Lotacao[];
  selectedLotacaoId: number | undefined;
  onLotacaoChange: (id: number | undefined) => void;
  onLoad: () => void;
}

export function FilterBar({
  employee,
  startMonth, startYear,
  endMonth, endYear,
  onStartMonthChange, onEndMonthChange,
  funcionarios, selectedFuncId, onFuncChange,
  lotacoes, selectedLotacaoId, onLotacaoChange,
  onLoad,
}: FilterBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button type="button" className={styles.filterBtn}>
          <ChevronDown size={14} />
          Filtros
        </button>

        {lotacoes.length > 0 && (
          <select
            className={styles.select}
            value={selectedLotacaoId ?? ''}
            onChange={(e) => onLotacaoChange(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">Todas as lotações</option>
            {lotacoes.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        )}

        {funcionarios.length > 0 ? (
          <select
            className={styles.select}
            value={selectedFuncId ?? ''}
            onChange={(e) => onFuncChange(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">Meu ponto</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        ) : employee ? (
          <div className={styles.employeeSelector}>
            <Avatar initials={employee.initials} size="sm" />
            <div className={styles.employeeInfo}>
              <span className={styles.employeeName}>{employee.fullName}</span>
              <span className={styles.employeeMeta}>mat. {employee.matricula} · {employee.lotacao}</span>
            </div>
          </div>
        ) : null}

        <span className={styles.periodLabel}>De</span>
        <select
          className={styles.select}
          value={startMonth}
          onChange={(e) => onStartMonthChange(Number(e.target.value), startYear)}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={startYear}
          onChange={(e) => onStartMonthChange(startMonth, Number(e.target.value))}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <span className={styles.dateRangeArrow}>→</span>

        <span className={styles.periodLabel}>Até</span>
        <select
          className={styles.select}
          value={endMonth}
          onChange={(e) => onEndMonthChange(Number(e.target.value), endYear)}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={endYear}
          onChange={(e) => onEndMonthChange(endMonth, Number(e.target.value))}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button type="button" className={styles.loadBtn} onClick={onLoad}>
          <RefreshCw size={14} />
          Carregar
        </button>
      </div>

    </div>
  );
}
