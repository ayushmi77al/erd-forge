import { PanelLeftOpen, Save } from "lucide-react";
import type React from "react";
import { useSdlStore } from "../../stores/sdlStore";
import type { ViewMode } from "../../stores/uiStore";
import { useUIStore } from "../../stores/uiStore";
import styles from "./MainToolbar.module.css";

const VIEW_MODES: { label: string; ariaLabel: string; value: ViewMode }[] = [
  { label: "SDL", ariaLabel: "SDL editor view", value: "sdl" },
  { label: "Split", ariaLabel: "Split editor and canvas view", value: "split" },
  { label: "Canvas", ariaLabel: "ERD canvas view", value: "canvas" },
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
            type="button"
            className={styles.catalogBtn}
            onClick={toggleLeftPanel}
            title="Open Catalog (Sidebar)"
            aria-label="Open catalog sidebar"
            aria-expanded={false}
          >
            <PanelLeftOpen size={15} aria-hidden="true" />
            <span>Catalog</span>
          </button>
        )}
        <button
          type="button"
          className={styles.button}
          title="Save Schema (Ctrl+S)"
          onClick={saveToFile}
          disabled={isSaving}
          aria-label="Save schema"
        >
          <Save size={16} aria-hidden="true" />
        </button>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.modeSelector} role="tablist" aria-label="Editor layout view">
          {VIEW_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={viewMode === m.value}
              aria-label={m.ariaLabel}
              className={`${styles.modeBtn} ${viewMode === m.value ? styles.active : ""}`}
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
