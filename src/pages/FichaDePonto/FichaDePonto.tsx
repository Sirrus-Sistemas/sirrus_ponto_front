import { useEffect, useMemo, useState } from 'react';
import { useFichaDePonto } from './useFichaDePonto';
import { FilterBar } from './components/FilterBar/FilterBar';
import { EmployeeStrip } from './components/EmployeeStrip/EmployeeStrip';
import { PunchGrid } from './components/PunchGrid/PunchGrid';
import { ApuracaoFooter } from './components/ApuracaoFooter/ApuracaoFooter';
import { fetchLotacoes, type Lotacao } from '../../services/lotacoesApi';
import styles from './FichaDePonto.module.css';

export function FichaDePonto() {
  const now = new Date();
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [startYear,  setStartYear]  = useState(now.getFullYear());
  const [endMonth,   setEndMonth]   = useState(now.getMonth() + 1);
  const [endYear,    setEndYear]    = useState(now.getFullYear());
  const [selectedFuncId, setSelectedFuncId] = useState<number | undefined>(undefined);
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([]);
  const [selectedLotacaoId, setSelectedLotacaoId] = useState<number | undefined>(undefined);

  const { data, loading, error, me, funcionarios, reload } = useFichaDePonto({
    employeeId: selectedFuncId,
    startMonth,
    startYear,
    endMonth,
    endYear,
  });

  const canSelectFunc = me?.role === 'admin' || me?.role === 'gestor';

  useEffect(() => {
    if (canSelectFunc) {
      fetchLotacoes().then(setLotacoes).catch(() => {});
    }
  }, [canSelectFunc]);

  const funcionariosFiltrados = useMemo(() => {
    if (!selectedLotacaoId) return funcionarios;
    return funcionarios.filter((f) => f.lotacao_id === selectedLotacaoId);
  }, [funcionarios, selectedLotacaoId]);

  function handleStartMonthChange(month: number, year: number) {
    setStartMonth(month);
    setStartYear(year);
    // Se o fim ficou antes do início, alinha o fim com o início
    const startVal = year * 100 + month;
    const endVal   = endYear * 100 + endMonth;
    if (endVal < startVal) {
      setEndMonth(month);
      setEndYear(year);
    }
  }

  function handleEndMonthChange(month: number, year: number) {
    setEndMonth(month);
    setEndYear(year);
    // Se o início ficou depois do fim, alinha o início com o fim
    const startVal = startYear * 100 + startMonth;
    const endVal   = year * 100 + month;
    if (startVal > endVal) {
      setStartMonth(month);
      setStartYear(year);
    }
  }

  return (
    <div className={styles.page}>
      <FilterBar
        employee={data?.employee ?? null}
        startMonth={startMonth}
        startYear={startYear}
        endMonth={endMonth}
        endYear={endYear}
        onStartMonthChange={handleStartMonthChange}
        onEndMonthChange={handleEndMonthChange}
        funcionarios={canSelectFunc ? funcionariosFiltrados : []}
        selectedFuncId={selectedFuncId}
        onFuncChange={setSelectedFuncId}
        lotacoes={canSelectFunc ? lotacoes : []}
        selectedLotacaoId={selectedLotacaoId}
        onLotacaoChange={(id) => { setSelectedLotacaoId(id); setSelectedFuncId(undefined); }}
        onLoad={reload}
      />

      {data && (
        <EmployeeStrip employee={data.employee} folhaStatus={data.folhaStatus} />
      )}

      <div className={styles.gridArea}>
        {loading && <div className={styles.stateMsg}>Carregando…</div>}
        {error   && <div className={styles.errorMsg}>{error}</div>}
        {!loading && !error && data && (
          <PunchGrid
            days={data.days}
            funcionarioId={data.funcionarioId}
            funcionarioNome={data.employee.fullName}
            turnoId={data.turnoId}
            onReload={reload}
          />
        )}
      </div>

      {data && <ApuracaoFooter summary={data.summary} />}
    </div>
  );
}
