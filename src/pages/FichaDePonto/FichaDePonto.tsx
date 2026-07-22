import { useEffect, useMemo, useState } from 'react';
import { useFichaDePonto } from './useFichaDePonto';
import { FilterBar } from './components/FilterBar/FilterBar';
import { EmployeeStrip } from './components/EmployeeStrip/EmployeeStrip';
import { PunchGrid } from './components/PunchGrid/PunchGrid';
import { ApuracaoFooter } from './components/ApuracaoFooter/ApuracaoFooter';
import { BloquearPeriodoModal } from './components/BloquearPeriodoModal/BloquearPeriodoModal';
import { JustificarPeriodoModal } from './components/JustificarPeriodoModal/JustificarPeriodoModal';
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

  const [showBloquearModal, setShowBloquearModal] = useState(false);
  const [showJustificarModal, setShowJustificarModal] = useState(false);

  const { data, loading, error, me, funcionarios, reload, toggleBloqueio, bloquearPeriodo, desbloquearPeriodo, justificarPeriodo } = useFichaDePonto({
    employeeId: selectedFuncId,
    startMonth,
    startYear,
    endMonth,
    endYear,
  });

  const canSelectFunc = me?.role === 'admin' || me?.role === 'gestor';

  // Resolve o nome da lotação a partir da lista de funcionários (que já traz lotacao_nome)
  const lotacaoNome = useMemo(() => {
    if (selectedFuncId) {
      return funcionarios.find((f) => f.id === selectedFuncId)?.lotacao_nome ?? null;
    }
    if (me && funcionarios.length > 0) {
      return funcionarios.find((f) => f.id === me.id)?.lotacao_nome ?? null;
    }
    return null;
  }, [selectedFuncId, funcionarios, me]);

  // Injeta a lotação correta no employee sem refazer o fetch
  const dataComLotacao = useMemo(() => {
    if (!data) return null;
    return { ...data, employee: { ...data.employee, lotacao: lotacaoNome ?? '—' } };
  }, [data, lotacaoNome]);

  useEffect(() => {
    if (canSelectFunc) {
      fetchLotacoes().then(setLotacoes).catch(() => {});
    }
  }, [canSelectFunc]);

  const funcionariosFiltrados = useMemo(() => {
    if (!selectedLotacaoId) return funcionarios;
    return funcionarios.filter((f) => f.lotacao_id === selectedLotacaoId);
  }, [funcionarios, selectedLotacaoId]);

  function handlePrint() {
    const funcId = selectedFuncId ?? me?.id;
    if (!funcId || !dataComLotacao) return;

    const openPrint = (mes: number, ano: number) => {
      const qs = new URLSearchParams({
        mes: String(mes),
        ano: String(ano),
        escopo: 'funcionario',
        func_id: String(funcId),
      });
      window.open(`/relatorios/espelho/print?${qs.toString()}`, '_blank');
    };

    openPrint(startMonth, startYear);
    if (startMonth !== endMonth || startYear !== endYear) {
      openPrint(endMonth, endYear);
    }
  }

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
        employee={dataComLotacao?.employee ?? null}
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
        onPrint={dataComLotacao ? handlePrint : undefined}
        onBloquearPeriodo={canSelectFunc ? () => setShowBloquearModal(true) : undefined}
        onJustificarPeriodo={canSelectFunc && dataComLotacao ? () => setShowJustificarModal(true) : undefined}
      />

      {dataComLotacao && (
        <EmployeeStrip
          employee={dataComLotacao.employee}
          folhaStatus={dataComLotacao.folhaStatus}
          onPrev={canSelectFunc && funcionariosFiltrados.length > 1 ? () => {
            const idx = funcionariosFiltrados.findIndex((f) => f.id === (selectedFuncId ?? me?.id));
            const prev = funcionariosFiltrados[idx - 1];
            if (prev) setSelectedFuncId(prev.id);
          } : undefined}
          onNext={canSelectFunc && funcionariosFiltrados.length > 1 ? () => {
            const idx = funcionariosFiltrados.findIndex((f) => f.id === (selectedFuncId ?? me?.id));
            const next = funcionariosFiltrados[idx + 1];
            if (next) setSelectedFuncId(next.id);
          } : undefined}
          currentIndex={canSelectFunc && funcionariosFiltrados.length > 1
            ? funcionariosFiltrados.findIndex((f) => f.id === (selectedFuncId ?? me?.id))
            : undefined}
          totalCount={canSelectFunc && funcionariosFiltrados.length > 1 ? funcionariosFiltrados.length : undefined}
        />
      )}

      <div className={styles.gridArea}>
        {/* Loading inicial (sem dados ainda) */}
        {loading && !dataComLotacao && <div className={styles.stateMsg}>Carregando…</div>}
        {error && !dataComLotacao   && <div className={styles.errorMsg}>{error}</div>}

        {/* PunchGrid permanece montado durante reloads para não perder o scroll */}
        {dataComLotacao && (
          <PunchGrid
            days={dataComLotacao.days}
            funcionarioId={dataComLotacao.funcionarioId}
            funcionarioNome={dataComLotacao.employee.fullName}
            turnoId={dataComLotacao.turnoId}
            tzOffset={dataComLotacao.tzOffset}
            onReload={reload}
            reloading={loading}
            canEdit={canSelectFunc}
            onToggleBloqueio={toggleBloqueio}
          />
        )}
      </div>

      {dataComLotacao && <ApuracaoFooter summary={dataComLotacao.summary} />}

      {showBloquearModal && (
        <BloquearPeriodoModal
          funcionarios={funcionarios}
          lotacoes={lotacoes}
          defaultDataInicio={`${startYear}-${String(startMonth).padStart(2, '0')}-01`}
          defaultDataFim={(() => {
            const ultimo = new Date(endYear, endMonth, 0).getDate();
            return `${endYear}-${String(endMonth).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
          })()}
          onClose={() => setShowBloquearModal(false)}
          onBloquear={bloquearPeriodo}
          onDesbloquear={desbloquearPeriodo}
        />
      )}

      {showJustificarModal && dataComLotacao && (
        <JustificarPeriodoModal
          funcionarioId={dataComLotacao.funcionarioId}
          funcionarioNome={dataComLotacao.employee.fullName}
          defaultDataInicio={`${startYear}-${String(startMonth).padStart(2, '0')}-01`}
          defaultDataFim={(() => {
            const ultimo = new Date(endYear, endMonth, 0).getDate();
            return `${endYear}-${String(endMonth).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
          })()}
          onClose={() => setShowJustificarModal(false)}
          onJustificar={justificarPeriodo}
        />
      )}
    </div>
  );
}
