import {
  ChevronDown,
  Columns3,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { downloadImage, exportLineageToCsv } from "../../lineage/utils/exportUtils";
import { useLineageStore } from "../../stores/lineageStore";
import styles from "./LineageToolbar.module.css";
import { SquishyToggle } from "./SquishyToggle";

interface LineageToolbarProps {
  onAnalyze?: () => void;
}

export const LineageToolbar: React.FC<LineageToolbarProps> = ({ onAnalyze }) => {
  const viewMode = useLineageStore((s) => s.viewMode);
  const setViewMode = useLineageStore((s) => s.setViewMode);
  const cardDisplayMode = useLineageStore((s) => s.cardDisplayMode);
  const setCardDisplayMode = useLineageStore((s) => s.setCardDisplayMode);

  const isSQLEditorOpen = useLineageStore((s) => s.isSQLEditorOpen);
  const toggleSQLEditor = useLineageStore((s) => s.toggleSQLEditor);
  const isInspectorOpen = useLineageStore((s) => s.isInspectorOpen);
  const toggleInspector = useLineageStore((s) => s.toggleInspector);

  const isParsing = useLineageStore((s) => s.isParsing);
  const graph = useLineageStore((s) => s.graph);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportMenuOpen]);

  const handleExportPng = () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (el) downloadImage(el, "png", "sql-lineage");
    setIsExportMenuOpen(false);
  };

  const handleExportSvg = () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (el) downloadImage(el, "svg", "sql-lineage");
    setIsExportMenuOpen(false);
  };

  const handleExportCsv = () => {
    exportLineageToCsv(graph, "sql-lineage-columns");
    setIsExportMenuOpen(false);
  };

  return (
    <div className={styles.toolbar}>
      {/* Left controls: Panel toggles, Dialect & Samples */}
      <div className={styles.leftGroup}>
        {!isSQLEditorOpen && (
          <button
            className={styles.catalogBtn}
            onClick={toggleSQLEditor}
            title="Open SQL Editor"
            type="button"
            aria-label="Open SQL Editor"
          >
            <PanelLeftOpen size={16} aria-hidden="true" />
            <span>Editor</span>
          </button>
        )}
        {isSQLEditorOpen && (
          <button
            className={`${styles.iconBtn} ${styles.active}`}
            onClick={toggleSQLEditor}
            title="Hide SQL Editor Panel"
            type="button"
            aria-label="Toggle SQL Editor"
          >
            <PanelLeftClose size={16} aria-hidden="true" />
          </button>
        )}

        <button
          className={styles.analyzeBtn}
          onClick={onAnalyze}
          disabled={isParsing}
          title="Parse SQL and update visual lineage (Ctrl + Enter)"
          type="button"
        >
          <Play size={14} fill="currentColor" aria-hidden="true" />
          <span>Analyze Lineage</span>
        </button>

        <div className={styles.divider} />

        {/* Table vs Column lineage level */}
        <SquishyToggle
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Lineage view level"
          options={[
            {
              value: "table",
              label: "Entity",
              icon: <Layers size={14} aria-hidden="true" />,
              title: "Entity Level Lineage (Tables, CTEs, Subqueries)",
            },
            {
              value: "column",
              label: "Column",
              icon: <Columns3 size={14} aria-hidden="true" />,
              title: "Column Level Lineage",
            },
          ]}
        />

        {/* Compact vs Full Card toggle */}
        <SquishyToggle
          value={cardDisplayMode}
          onChange={setCardDisplayMode}
          ariaLabel="Card display mode"
          options={[
            {
              value: "full",
              label: "Full",
              icon: <Maximize2 size={13} aria-hidden="true" />,
              title: "Show full columns and details in nodes",
            },
            {
              value: "compact",
              label: "Compact",
              icon: <Minimize2 size={13} aria-hidden="true" />,
              title: "Show compact nodes",
            },
          ]}
        />
      </div>

      {/* Right controls: Export and Inspector toggle */}
      <div className={styles.rightGroup}>
        <div className={styles.exportWrapper} ref={exportMenuRef}>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            title="Export Lineage Graph"
            aria-label="Export lineage graph"
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
          >
            <Download size={13} aria-hidden="true" />
            <span>Export</span>
            <ChevronDown size={11} aria-hidden="true" />
          </button>

          {isExportMenuOpen && (
            <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`} role="menu">
              <button type="button" role="menuitem" className={styles.dropdownItem} onClick={handleExportPng}>
                <ImageIcon size={13} aria-hidden="true" />
                <span>Export as PNG</span>
              </button>
              <button type="button" role="menuitem" className={styles.dropdownItem} onClick={handleExportSvg}>
                <ImageIcon size={13} aria-hidden="true" />
                <span>Export as SVG</span>
              </button>
              <button type="button" role="menuitem" className={styles.dropdownItem} onClick={handleExportCsv}>
                <FileText size={13} aria-hidden="true" />
                <span>Export to CSV</span>
              </button>
            </div>
          )}
        </div>

        {!isInspectorOpen && (
          <button
            className={styles.catalogBtn}
            onClick={toggleInspector}
            title="Show Lineage Inspector"
            type="button"
            aria-label="Toggle Lineage Inspector"
          >
            <PanelRightOpen size={16} aria-hidden="true" />
            <span>Inspector</span>
          </button>
        )}
        {isInspectorOpen && (
          <button
            className={`${styles.iconBtn} ${styles.active}`}
            onClick={toggleInspector}
            title="Hide Lineage Inspector"
            type="button"
            aria-label="Toggle Lineage Inspector"
          >
            <PanelRightClose size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
