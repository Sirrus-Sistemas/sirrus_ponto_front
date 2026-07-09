import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { fetchBloqueadas, desbloquearBloqueada, type Bloqueada } from '../../../../services/fichaPontoApi';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  funcionarioId: number;
  onReload: () => void;
}

export function SidePanel({ funcionarioId, onReload }: SidePanelProps) {
  const [bloqueadas, setBloqueadas] = useState<Bloqueada[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desbloqueando, setDesbloqueando] = useState<number | null>(null);

  useEffect(() => {
    const carregarBloqueadas = async () => {
      try {
        setLoading(true);
        const dados = await fetchBloqueadas(funcionarioId);
        setBloqueadas(dados);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar batidas bloqueadas');
        setBloqueadas([]);
      } finally {
        setLoading(false);
      }
    };

    carregarBloqueadas();
  }, [funcionarioId]);

  const agrupadasPorGrupo = new Map<string, Bloqueada[]>();
  for (const b of bloqueadas) {
    if (!agrupadasPorGrupo.has(b.grupo_id)) {
      agrupadasPorGrupo.set(b.grupo_id, []);
    }
    agrupadasPorGrupo.get(b.grupo_id)!.push(b);
  }

  const grupos = Array.from(agrupadasPorGrupo.entries()).map(([grupoId, items]) => ({
    grupoId,
    items,
    motivo: items[0].motivo_bloqueio,
  }));

  const handleDesbloquear = async (id: number) => {
    try {
      setDesbloqueando(id);
      await desbloquearBloqueada(id);
      setBloqueadas((prev) => prev.filter((b) => b.id !== id));
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desbloquear batida');
    } finally {
      setDesbloqueando(null);
    }
  };

  return (
    <div className={styles.sidePanelContent}>
      <div className={styles.sectionHeader} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.headerTitle}>
          <AlertTriangle size={14} />
          <span>Batidas Bloqueadas</span>
          {grupos.length > 0 && <span className={styles.badge}>{grupos.length}</span>}
        </div>
        <ChevronDown size={16} className={isExpanded ? styles.chevronOpen : ''} />
      </div>

      {isExpanded && (
        <div className={styles.sectionContent}>
          {loading && <p className={styles.msg}>Carregando…</p>}
          {error && <p className={styles.msgError}>{error}</p>}
          {!loading && grupos.length === 0 && <p className={styles.msg}>Nenhuma batida bloqueada</p>}

          {!loading && grupos.length > 0 && (
            <div className={styles.gruposList}>
              {grupos.map((grupo) => (
                <div key={grupo.grupoId} className={styles.grupoItem}>
                  <p className={styles.grupoMotivo}>{grupo.motivo}</p>
                  <div className={styles.grupoHorarios}>
                    {grupo.items.map((b, idx) => (
                      <span key={b.id} className={styles.horario}>
                        {b.data_hora.substring(11, 19)}
                        {idx < grupo.items.length - 1 ? ' | ' : ''}
                      </span>
                    ))}
                  </div>
                  <div className={styles.grupoActions}>
                    {grupo.items.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleDesbloquear(b.id)}
                        disabled={desbloqueando === b.id}
                        className={styles.btnDesbloquear}
                      >
                        {desbloqueando === b.id ? 'Desbloqueando…' : 'Desbloquear'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
