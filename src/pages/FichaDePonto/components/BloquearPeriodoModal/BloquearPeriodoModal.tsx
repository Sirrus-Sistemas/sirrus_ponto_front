import { useMemo, useState } from 'react';
import { Lock, LockOpen, X } from 'lucide-react';
import { ApiError } from '../../../../lib/api';
import type { FuncionarioListItem } from '../../../../services/funcionariosApi';
import type { Lotacao } from '../../../../services/lotacoesApi';
import styles from './BloquearPeriodoModal.module.css';

type Scope = 'todos' | 'lotacao' | 'especificos';
type Mode  = 'bloquear' | 'desbloquear';

type Resultado =
  | { tipo: 'bloquear';    funcionarios: number; dias: number; total: number }
  | { tipo: 'desbloquear'; removidos: number };

interface Props {
  funcionarios: FuncionarioListItem[];
  lotacoes: Lotacao[];
  defaultDataInicio: string;
  defaultDataFim: string;
  onClose: () => void;
  onBloquear: (params: {
    data_inicio: string;
    data_fim: string;
    funcionario_ids?: number[];
  }) => Promise<{ funcionarios: number; dias: number; total: number }>;
  onDesbloquear: (params: {
    data_inicio: string;
    data_fim: string;
    funcionario_ids?: number[];
  }) => Promise<{ removidos: number }>;
}

function countDays(inicio: string, fim: string): number {
  if (!inicio || !fim || fim < inicio) return 0;
  const a = new Date(inicio + 'T12:00:00Z');
  const b = new Date(fim + 'T12:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function toggleSet(prev: Set<number>, id: number): Set<number> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export function BloquearPeriodoModal({
  funcionarios,
  lotacoes,
  defaultDataInicio,
  defaultDataFim,
  onClose,
  onBloquear,
  onDesbloquear,
}: Props) {
  const [mode, setMode] = useState<Mode>('bloquear');
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [scope, setScope] = useState<Scope>('todos');
  const [selectedLotacaoIds, setSelectedLotacaoIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const diasCount = useMemo(() => countDays(dataInicio, dataFim), [dataInicio, dataFim]);

  const funcsPorLotacao = useMemo(
    () => funcionarios.filter((f) => f.lotacao_id !== null && selectedLotacaoIds.has(f.lotacao_id)),
    [funcionarios, selectedLotacaoIds],
  );

  const funcCount =
    scope === 'todos'    ? funcionarios.length :
    scope === 'lotacao'  ? funcsPorLotacao.length :
                           selectedIds.size;

  function buildParams() {
    let funcionario_ids: number[] | undefined;
    if (scope === 'lotacao')     funcionario_ids = funcsPorLotacao.map((f) => f.id);
    if (scope === 'especificos') funcionario_ids = [...selectedIds];
    return { data_inicio: dataInicio, data_fim: dataFim, funcionario_ids };
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);

    if (!dataInicio) { setError('Informe a data início.'); return; }
    if (!dataFim)    { setError('Informe a data fim.'); return; }
    if (dataFim < dataInicio) { setError('Data fim deve ser igual ou posterior à data início.'); return; }
    if (scope === 'lotacao'     && selectedLotacaoIds.size === 0) { setError('Selecione ao menos uma lotação.'); return; }
    if (scope === 'especificos' && selectedIds.size === 0)        { setError('Selecione ao menos um funcionário.'); return; }
    if (scope !== 'todos' && funcCount === 0) { setError('Nenhum funcionário ativo encontrado para a seleção.'); return; }

    setSubmitting(true);
    try {
      if (mode === 'bloquear') {
        const r = await onBloquear(buildParams());
        setResultado({ tipo: 'bloquear', ...r });
      } else {
        const r = await onDesbloquear(buildParams());
        setResultado({ tipo: 'desbloquear', ...r });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível executar a operação.');
    } finally {
      setSubmitting(false);
    }
  }

  if (resultado) {
    return (
      <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Gerenciar Bloqueios em Massa</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>
          <div className={styles.successBox}>
            {resultado.tipo === 'bloquear'
              ? <Lock size={32} className={styles.successIconLock} />
              : <LockOpen size={32} className={styles.successIconUnlock} />
            }
            <p className={styles.successTitle}>
              {resultado.tipo === 'bloquear' ? 'Período bloqueado com sucesso!' : 'Período desbloqueado com sucesso!'}
            </p>
            <p className={styles.successSub}>
              {resultado.tipo === 'bloquear' ? (
                <><strong>{resultado.total.toLocaleString('pt-BR')}</strong> registros bloqueados —{' '}
                {resultado.dias} {resultado.dias === 1 ? 'dia' : 'dias'} para{' '}
                {resultado.funcionarios} {resultado.funcionarios === 1 ? 'funcionário' : 'funcionários'}.</>
              ) : (
                <><strong>{resultado.removidos.toLocaleString('pt-BR')}</strong> {resultado.removidos === 1 ? 'registro desbloqueado' : 'registros desbloqueados'}.</>
              )}
            </p>
            <button type="button" className={styles.btnPrimary} onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Gerenciar Bloqueios em Massa</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>

        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'bloquear' ? styles.modeBtnActiveLock : ''}`}
            onClick={() => setMode('bloquear')}
          >
            <Lock size={14} />
            Bloquear
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'desbloquear' ? styles.modeBtnActiveUnlock : ''}`}
            onClick={() => setMode('desbloquear')}
          >
            <LockOpen size={14} />
            Desbloquear
          </button>
        </div>

        <p className={mode === 'bloquear' ? styles.descricaoWarn : styles.descricaoInfo}>
          {mode === 'bloquear'
            ? 'Todos os dias do período selecionado serão bloqueados contra sobrescrita por importação de REP ou aplicativo.'
            : 'Apenas os dias que estiverem bloqueados no período serão liberados.'
          }
        </p>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="bp-inicio">Data início</label>
              <input id="bp-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="bp-fim">Data fim</label>
              <input id="bp-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className={styles.fieldset}>
            <span className={styles.fieldsetLabel}>Funcionários</span>

            <label className={styles.radioRow}>
              <input type="radio" name="bp-scope" checked={scope === 'todos'} onChange={() => setScope('todos')} />
              Todos os funcionários ativos
              {funcionarios.length > 0 && <span className={styles.badge}>{funcionarios.length}</span>}
            </label>

            {lotacoes.length > 0 && (
              <label className={styles.radioRow}>
                <input type="radio" name="bp-scope" checked={scope === 'lotacao'} onChange={() => setScope('lotacao')} />
                Por lotação
                {scope === 'lotacao' && selectedLotacaoIds.size > 0 && (
                  <span className={styles.badge}>{funcsPorLotacao.length} funcionário{funcsPorLotacao.length !== 1 ? 's' : ''}</span>
                )}
              </label>
            )}

            <label className={styles.radioRow}>
              <input type="radio" name="bp-scope" checked={scope === 'especificos'} onChange={() => setScope('especificos')} />
              Selecionar específicos
              {scope === 'especificos' && selectedIds.size > 0 && (
                <span className={styles.badge}>{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
              )}
            </label>

            {scope === 'lotacao' && (
              <div className={styles.funcList}>
                {lotacoes.map((l) => {
                  const count = funcionarios.filter((f) => f.lotacao_id === l.id).length;
                  return (
                    <label key={l.id} className={styles.funcItem}>
                      <input
                        type="checkbox"
                        checked={selectedLotacaoIds.has(l.id)}
                        onChange={() => setSelectedLotacaoIds((p) => toggleSet(p, l.id))}
                      />
                      <span className={styles.funcNome}>{l.nome}</span>
                      <span className={styles.funcMat}>{count} func.</span>
                    </label>
                  );
                })}
              </div>
            )}

            {scope === 'especificos' && (
              <div className={styles.funcList}>
                {funcionarios.map((f) => (
                  <label key={f.id} className={styles.funcItem}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.id)}
                      onChange={() => setSelectedIds((p) => toggleSet(p, f.id))}
                    />
                    <span className={styles.funcNome}>{f.nome}</span>
                    {f.matricula && <span className={styles.funcMat}>{f.matricula}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {diasCount > 0 && funcCount > 0 && (
            <div className={mode === 'bloquear' ? styles.previewLock : styles.previewUnlock}>
              {mode === 'bloquear' ? <Lock size={14} /> : <LockOpen size={14} />}
              <span>
                <strong>{diasCount}</strong> {diasCount === 1 ? 'dia' : 'dias'} ×{' '}
                <strong>{funcCount}</strong> {funcCount === 1 ? 'funcionário' : 'funcionários'} ={' '}
                <strong>{(diasCount * funcCount).toLocaleString('pt-BR')}</strong>{' '}
                {mode === 'bloquear' ? 'registros serão bloqueados' : 'registros serão verificados (só desbloqueados os que estiverem bloqueados)'}
              </span>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className={mode === 'bloquear' ? styles.btnPrimary : styles.btnDanger}
              disabled={submitting || diasCount === 0 || funcCount === 0}
            >
              {submitting
                ? (mode === 'bloquear' ? 'Bloqueando…' : 'Desbloqueando…')
                : (mode === 'bloquear' ? 'Bloquear período' : 'Desbloquear período')
              }
            </button>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
