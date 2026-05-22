import { PanelLeft, Save, Calculator, Printer, MoreVertical } from 'lucide-react';
import styles from './Topbar.module.css';

interface TopbarProps {
  unsavedCount: number;
  onSave?: () => void;
  onCalcular?: () => void;
  onPrint?: () => void;
  onToggleSidebar?: () => void;
}

export function Topbar({ unsavedCount, onSave, onCalcular, onPrint, onToggleSidebar }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button type="button" className={styles.iconBtn} onClick={onToggleSidebar} title="Alternar painel">
          <PanelLeft size={18} />
        </button>
        <nav className={styles.breadcrumb} aria-label="Navegação">
          <span className={styles.crumbMuted}>Sistema</span>
          <span className={styles.sep}>›</span>
          <span className={styles.crumbMuted}>Ponto</span>
          <span className={styles.sep}>›</span>
          <span className={styles.crumbActive}>Ficha de Ponto</span>
        </nav>
      </div>

      <div className={styles.right}>
        {unsavedCount > 0 && (
          <div className={styles.pendingChip}>
            <span className={styles.pendingDot} />
            <span>{unsavedCount} alterações pendentes</span>
          </div>
        )}

        <button
          type="button"
          className={`${styles.btn} ${unsavedCount > 0 ? styles.btnSave : styles.btnSaveDisabled}`}
          onClick={onSave}
          disabled={unsavedCount === 0}
        >
          <Save size={15} />
          Salvar
        </button>

        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCalcular}>
          <Calculator size={15} />
          Calcular folha
        </button>

        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onPrint}>
          <Printer size={15} />
          Imprimir PDF
        </button>

        <button type="button" className={styles.iconBtn} title="Mais opções">
          <MoreVertical size={16} />
        </button>
      </div>
    </header>
  );
}
