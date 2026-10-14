import React from 'react';
import styles from './MainToolbar.module.css';
import { Save, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import type { ViewMode } from '../../stores/uiStore';
import { useSdlStore } from '../../stores/sdlStore';

const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'SDL', value: 'sdl' },
  { label: 'Split', value: 'split' },
  { label: 'Canvas', value: 'canvas' },
];

export const MainToolbar: React.FC = () => {
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);

  const saveToFile = useSdlStore((s) => s.saveToFile);
  const isSaving = useSdlStore((s) => s.isSaving);

  return (
    <div className={styles.toolbar}>
      <div className={styles.leftGroup}>
        {!leftPanelOpen && (
          <button 
            className={styles.catalogBtn}
            onClick={toggleLeftPanel}
            title="Open Catalog (Sidebar)"
            aria-label="Open Catalog"
          >
            <PanelLeftOpen size={15} />
            <span>Catalog</span>
          </button>
        )}
        <button 
          className={styles.button} 
          title="Save Schema (Ctrl+S)"
          onClick={saveToFile}
          disabled={isSaving}
          aria-label="Save"
        >
          <Save size={16} />
        </button>

        <div className={styles.divider} />

        <div className={styles.modeSelector}>
          {VIEW_MODES.map((m) => (
            <button
              key={m.value}
              className={`${styles.modeBtn} ${viewMode === m.value ? styles.active : ''}`}
              onClick={() => setViewMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

